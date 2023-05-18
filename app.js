const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());

let database = null;

let initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running successfully");
    });
  } catch (error) {
    console.log(`Database Error : ${error.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

app.post("/login", async (request, response) => {
  let { username, password } = request.body;
  let UserExistenceCheckInDatabase_query = `
        SELECT
            *
        FROM
            user
        WHERE
            username = '${username}';
   `;
  let result = await database.get(UserExistenceCheckInDatabase_query);
  if (result === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let isPasswordMatched = await bcrypt.compare(password, result.password);
    if (isPasswordMatched) {
      const payload = {
        username,
      };
      let jwtToken = jwt.sign(payload, "no_secret");
      response.send({
        jwtToken,
      });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication of Token
let authenticateToken = (request, response, next) => {
  let accessToken;
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    accessToken = authHeader.split(" ")[1];
  }
  if (accessToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(accessToken, "no_secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Get the list of details of all states
app.get("/states/", authenticateToken, async (request, response) => {
  let sql_query = `
        SELECT
            state_id AS stateId,
            state_name AS stateName,
            population
        FROM
            state;`;
  let result = await database.all(sql_query);
  response.send(result);
});

//Get a specific state details
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  let { stateId } = request.params;
  let sql_query = `
        SELECT
            state_id AS stateId,
            state_name AS stateName,
            population
        FROM
            state
        WHERE state_id = ${stateId};
    `;
  let result = await database.get(sql_query);
  response.send(result);
});

//Creating a district in the district table
app.post("/districts", authenticateToken, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let post_sql_query = `
        INSERT INTO district
            (district_name, state_id, cases, cured, active, deaths)
        VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await database.run(post_sql_query);
  response.send("District Successfully Added");
});

//Returning district details based on district ID
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    let sql_query = `
        SELECT
            district_id AS districtId,
            district_name AS districtName,
            state_id AS stateId,
            cases,
            cured,
            active,
            deaths
        FROM district
        WHERE district_id = ${districtId};`;
    let result = await database.get(sql_query);
    response.send(result);
  }
);

//Delete a district
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    let delete_sql_query = `
        DELETE FROM district
        WHERE district_id = ${districtId};`;
    await database.run(delete_sql_query);
    response.send("District Removed");
  }
);

//Update a district
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    let { districtId } = request.params;
    let update_sql_query = `
    UPDATE
        district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE
        district_id = ${districtId};`;
    await database.run(update_sql_query);
    response.send("District Details Updated");
  }
);

//Return the statistics based on state ID
app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    let { stateId } = request.params;
    let sql_query = `
        SELECT
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM
            district
        WHERE
            state_id = ${stateId};`;
    let result = await database.get(sql_query);
    response.send(result);
  }
);

module.exports = app; 