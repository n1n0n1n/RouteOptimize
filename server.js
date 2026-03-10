const express = require("express");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const SECRET = "routewiz_secret";


// 1. Import the AI at the very top of your server.js
const { GoogleGenerativeAI } = require("@google/generative-ai");


const genAI = new GoogleGenerativeAI("AIzaSyBhs6Q3j1SSBLztxKO2bpPcCR9gAKYPHWY"); 

app.post("/api/smart-route", async (req, res) => {
    try {
        const { text } = req.body;
        console.log("\n--- NEW AI REQUEST ---");
        console.log("1. Received text from user:", text);
        
        // Make sure we are using the universal gemini-pro model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `
            You are a logistics routing assistant for Metro Manila. 
            Extract the pickup and drop-off locations from the following text in the exact logical order they should be visited. 
            Return ONLY a valid JSON array of strings. Do not include markdown formatting, backticks, or any conversational words. 
            Example output: ["SM North EDSA", "UP Diliman", "BGC"]. 
            User text: "${text}"
        `;

        console.log("2. Sending to Google Gemini...");
        const result = await model.generateContent(prompt);
        let aiText = result.response.text();
        
        console.log("3. Raw AI Response received:", aiText);

        // Clean up the text just in case the AI added markdown backticks
        aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const addresses = JSON.parse(aiText); 
        console.log("4. Successfully converted to array:", addresses);
        
        res.json(addresses); 

    } catch (error) {
        console.error("🔥 BACKEND ERROR DETAILS:", error.message || error);
        res.status(500).json({ error: "Failed to parse route from text." });
    }
});

function readUsers() {
    return JSON.parse(fs.readFileSync("users.json"));
}
function writeUsers(x) {
    fs.writeFileSync("users.json", JSON.stringify(x,null,2));
}


function readTrips() {
    return JSON.parse(fs.readFileSync("trips.json"));
}
function writeTrips(x) {
    fs.writeFileSync("trips.json", JSON.stringify(x,null,2));
}


function auth(req,res,next){
    try {
        const token = req.headers.authorization.split(" ")[1];
        req.user = jwt.verify(token,SECRET);
        next();
    } catch {
        res.json({error:"Unauthorized"});
    }
}


app.post("/api/register",(req,res)=>{
    const users = readUsers();
    const {email,password} = req.body;

    if (users.find(u=>u.email===email))
        return res.json({error:"Email exists"});

    users.push({
        id:Date.now(),
        email,
        password: bcrypt.hashSync(password,10)
    });

    writeUsers(users);
    res.json({success:true});
});


app.post("/api/login",(req,res)=>{
    const users = readUsers();
    const {email,password} = req.body;

    const u = users.find(x=>x.email===email);
    if (!u) return res.json({error:"Invalid"});

    if (!bcrypt.compareSync(password, u.password))
        return res.json({error:"Invalid"});

    const token = jwt.sign({id:u.id,email:u.email},SECRET,{expiresIn:"7d"});

    res.json({token});
});


app.post("/api/trip", auth,(req,res)=>{
    const trips = readTrips();
    trips.push({
        user:req.user.id,
        ...req.body
    });
    writeTrips(trips);
    res.json({success:true});
});


app.get("/api/trips", auth,(req,res)=>{
    const trips = readTrips().filter(t=>t.user===req.user.id);
    res.json(trips);
});

app.listen(3000, ()=>console.log("RouteWiz running on http://localhost:3000"));
