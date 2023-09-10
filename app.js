const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const sqlite3 = require("sqlite");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());
let db;

const startServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3010, () => {
      console.log("Server running at http://localhost:3010/");
    });
  } catch (e) {
    console.log(`${e.message}`);
  }
};
// noinspection JSIgnoredPromiseFromCall
startServer();

// Middleware function for Authentication.
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "x_clone", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1
app.post("/register/", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const hashPassword = await bcrypt.hash(password, 10);
    const userQuery = `SELECT * FROM user WHERE username='${username}';`;
    const dbUser = await db.get(userQuery);
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else if (dbUser !== undefined) {
      response.status(400);
      response.send("User already exists");
    } else {
      const getQuery = `INSERT INTO user (username, password, name, gender)
            VALUES (
                username = '${username}',
                password = '${hashPassword}',
                name = '${name}',
                gender = '${gender}'
            );`;
      await db.run(getQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } catch (e) {
    console.log(`${e.message}`);
  }
});

// API 2
app.post("/login/", async (request, response) => {
  let match;
  try {
    const {username, password} = request.body;
    const userQuery = `SELECT *
                       FROM user
                       WHERE username = '${username}';`;
    const dbUser = await db.get(userQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      match = bcrypt.compare(password, dbUser.password);
      if (match === false) {
        response.status(400);
        response.send("Invalid password");
      } else {
        const payload = {username: username};
        const jwtToken = await jwt.sign(payload, "x_clone");
        response.send({jwtToken});
      }
    }
  } catch (e) {
    console.log(`${e.message}`);
  }
});
