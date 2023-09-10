const express = require("express");
const app = express();
app.use(express.json());
const{open} = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname,"twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const startServer = async()=>{
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    app.listen(3001,()=>{
        console.log("Server is running at http://localhost:3001/");
    });
}
// middleware function for authentication
const authToken = async(request, response, next)=>{
    const authHead = request.headers['authorization'];
    let jwtoken = authHead.split(" ")[1];
    if(authHead === undefined){
        response.status(401);
        response.send("Invalid JWT Token");
    }
    else{
        jwt.verify(jwtoken, "x",(error,payload)=>{
            if(error){
                response.status(401);
                response.send("Invalid JWT Token");
            }
            else{
                next();
            }
        })
    }
}

app.post("/login/", async(request, response)=>{
    const {username, password} = request.body;
    const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
    const dbUser = await db.get(dbQuery);
    if(dbUser === undefined){
        response.status(400);
        response.send("Invalid User");
    }
    else {
        const match = await bcrypt.compare(password,dbUser.password);
        if(match){
            const payload = {username:username};
            const token = await jwt.sign(payload,"x");
            response.send({jwtToken:token});
        }
        else{
            response.status(400);
            response.send("Invalid Password");
        }
    }
})