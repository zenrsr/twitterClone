const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { request } = require("express");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const startServer = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  app.listen(3009, () => {
    console.log("Server running at http://localhost:3009/");
  });
};

startServer();

const authToken = async (request, response, next) => {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  const authHead = request.headers["authorization"];
  let token;
  if (authHead !== undefined) {
    token = authHead.split(" ")[1];
  }
  if (token === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(token, "x", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweetId = tweetId;
        request.tweet = tweet;
        // console.log(payload);
        next();
      }
    });
  }
};

// API 1
app.post("/register/", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
    const dbUser = await db.get(dbQuery);
    if (dbUser === undefined) {
      if (password.length < 6) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const passKey = await bcrypt.hash(password, 11);
        const getQuery = `INSERT INTO user(username, name, password, gender)
                            VALUES ('${username}','${name}','${passKey}','${gender}');`;
        await db.run(getQuery);
        response.status(200).send("User created successfully");
      }
    } else {
      response.status(400).send("User already exists");
    }
  } catch (e) {
    console.log(e.message);
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(dbQuery);
  if (dbUser !== undefined) {
    const match = await bcrypt.compare(password, dbUser.password);
    if (match) {
      const jwtToken = await jwt.sign(dbUser, "x");
      response.status(200).send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  } else {
    response.status(400).send("Invalid user");
  }
});

// API 3
app.get("/user/tweets/feed/", authToken, async (request, response) => {
  try {
    const { payload } = request;
    console.log(payload);
    const { user_id } = payload;
    const getQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime
            FROM follower INNER JOIN tweet 
                ON follower.following_user_id = tweet.user_id
            INNER JOIN user 
                ON follower.following_user_id = user.User_id
            WHERE 
                follower.follower_user_id = ${user_id} ORDER BY date_time DESC LIMIT 4;`;
    const x = await db.all(getQuery);
    response.send(x);
  } catch (e) {
    console.log(e.message);
  }
});

// API 4
app.get("/user/following/", authToken, async (request, response) => {
  const { payload } = request;
  // response.send({payload});
  const { user_id } = payload;
  const getQuery = `SELECT user.name FROM user INNER JOIN follower ON follower.following_user_id = user.user_id WHERE follower.follower_user_id = ${user_id}`;
  const x = await db.all(getQuery);
  response.send(x);
});

// API 5
app.get("/user/followers/", authToken, async (request, response) => {
  const { payload } = request;
  const { user_id } = payload;
  const getQuery = `SELECT user.name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id WHERE follower.following_user_id = ${user_id}`;
  const x = await db.all(getQuery);
  response.send(x);
});

//API 6
app.get("/tweets/:tweetId/", authToken, async (request, response) => {
  try {
    const { tweetId } = request;
    const { payload } = request;
    // response.send(payload);
    const { user_id } = payload;
    const tweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;
    const tweetResult = await db.get(tweetQuery);
    // console.log(tweetResult);
    const getQuery = `
            SELECT * FROM user INNER JOIN follower ON user.user_id = follower.following_user_id 
                     WHERE follower.follower_user_id = ${user_id}
        `;
    const userFollowers = await db.all(getQuery);
    // response.send(userFollowers);
    if (
      userFollowers.some((i) => {
        // noinspection BadExpressionStatementJS
        return i.following_user_id === tweetResult.user_id;
      })
    ) {
      const mainQuery = `
                SELECT tweet.tweet,
                       count(distinct (like.like_id)) as likes,
                       count(distinct (reply.reply_id)) as replies,
                       tweet.date_time as dateTime
                FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
                INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
                WHERE
                    tweet.tweet_id = ${tweetId} and tweet.user_id = ${userFollowers[0].user_id}`;
      const x = await db.get(mainQuery);
      response.send(x);
    } else {
      response.status(401).send("Invalid Request");
    }
  } catch (e) {
    console.log(e.message);
  }
});

// API 7
app.get("/tweets/:tweetId/likes/", authToken, async (request, response) => {
  try {
    const { payload } = request;
    const { tweetId } = request;
    const { user_id } = payload;
    const mainQuery = `
            SELECT * FROM tweet INNER JOIN follower ON follower.following_user_id = tweet.user_id
            INNER JOIN like ON like.tweet_id = tweet.tweet_id INNER JOIN user ON user.user_id = like.user_id
            WHERE 
                tweet.tweet_id = ${tweetId} and follower.follower_user_id = ${user_id};`;
    const x = await db.all(mainQuery);
    // console.log(x);
    let likes = [];
    if (x.length !== 0) {
      for (let i of x) {
        likes.push(i.username);
      }
      response.send({ likes });
    } else {
      response.status(401).send("Invalid Request");
    }
  } catch (e) {
    console.log(e.message);
  }
});

// API 8
app.get("/tweets/:tweetId/replies/", authToken, async (request, response) => {
  try {
    const { payload } = request;
    const { tweetId } = request;
    const { user_id } = payload;
    const getQuery = `
            SELECT * FROM tweet INNER JOIN follower ON follower.following_user_id = tweet.user_id
            INNER JOIN reply ON reply.tweet_id = tweet.tweet_id INNER JOIN user ON user.user_id = reply.user_id
            WHERE 
                tweet.tweet_id = ${tweetId} and follower.follower_user_id = ${user_id};`;
    const x = await db.all(getQuery);
    // console.log(x);
    if (x.length !== 0) {
      let replies = [];
      for (let i of x) {
        let result = {
          name: i.name,
          reply: i.reply,
        };
        replies.push(result);
      }
      response.status(200).send({ replies });
    } else {
      response.status(401).send("Invalid Request");
    }
  } catch (e) {
    console.log(e.message);
  }
});

// API 9
app.get("/user/tweets/", authToken, async (request, response) => {
  try {
    const { payload } = request;
    const { user_id } = payload;
    const getQuery = `
            SELECT distinct tweet.tweet, 
                            count(distinct (like.like_id)) as likes,
                            count(distinct (reply.reply_id)) as replies,
                            tweet.date_time as dateTime
            FROM 
                tweet inner join like on tweet.tweet_id = like.tweet_id
                inner join reply on tweet.tweet_id = reply.tweet_id
            WHERE
                tweet.user_id = ${user_id};
            GROUP BY
                 tweet.tweet
                `;
    const x = await db.all(getQuery);
    response.send(x);
  } catch (e) {
    console.log(e.message);
  }
});

// API 10
app.post("/user/tweets/", authToken, async (request, response) => {
  try {
    const tweet = request.body;
    // console.log(tweet.tweet);
    const { payload } = request;
    const { user_id } = payload;
    const getQuery = `INSERT INTO tweet (tweet,user_id) VALUES ('${tweet.tweet}',${user_id});`;
    await db.run(getQuery);
    response.send("Created a Tweet");
  } catch (e) {
    console.log(e.message);
  }
});

// API 11
app.delete("/tweets/:tweetId/", authToken, async (request, response) => {
  try {
    const { payload } = request;
    const { tweetId } = request;
    const { user_id } = payload;
    const selectUser = `
        SELECT * FROM tweet WHERE tweet.user_id = ${user_id} and tweet.tweet_id = ${tweetId};`;
    const tweetUser = await db.all(selectUser);
    if (tweetUser.length !== 0) {
      const getQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId} and tweet.user_id = ${user_id}`;
      await db.run(getQuery);
      response.status(200).send("Tweet Removed");
    } else {
      response.status(401).send("Invalid Request");
    }
  } catch (e) {
    console.log(e.message);
  }
});

module.exports = app;
