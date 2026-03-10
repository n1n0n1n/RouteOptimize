
let map;
let directionsService;
let directionsRenderer;

/* LOGIN SYSTEM */

function login(){

const email=document.getElementById("login-email").value;
const pw=document.getElementById("login-password").value;

if(email==="admin@demo.com" && pw==="password123"){

document.getElementById("login-screen").classList.remove("active");
document.getElementById("dashboard-screen").classList.add("active");

loadHistory();

}else{

alert("Invalid login");

}

}

function logout(){

location.reload();

}



/* GOOGLE MAP */

function initMap(){

const center={lat:14.5995,lng:120.9842};

map=new google.maps.Map(document.getElementById("map"),{
zoom:12,
center:center
});

directionsService=new google.maps.DirectionsService();
directionsRenderer=new google.maps.DirectionsRenderer();

directionsRenderer.setMap(map);


/* AUTOCOMPLETE */

new google.maps.places.Autocomplete(
document.getElementById("pickup-input")
);

new google.maps.places.Autocomplete(
document.getElementById("destination-input")
);

}


/* ROUTE OPTIMIZATION */

function optimizeRoute(){

const start=document.getElementById("pickup-input").value;
const end=document.getElementById("destination-input").value;

if(!start || !end){
alert("Enter route locations");
return;
}

const request={
origin:start,
destination:end,
travelMode:"DRIVING"
};

directionsService.route(request,function(result,status){

if(status==="OK"){
directionsRenderer.setDirections(result);
}

});

}



/* DISPATCH STORAGE */

function saveDispatch(){

const start=document.getElementById("pickup-input").value;
const end=document.getElementById("destination-input").value;
const vehicle=document.getElementById("vehicle-select").value;

if(!start || !end){
alert("Route incomplete");
return;
}

let history=JSON.parse(localStorage.getItem("dispatchHistory"))||[];

history.push({
route:start+" → "+end,
vehicle:vehicle,
time:new Date().toLocaleString()
});

localStorage.setItem("dispatchHistory",JSON.stringify(history));

loadHistory();

alert("Vehicle dispatched");

}


/* LOAD HISTORY */

function loadHistory(){

const container=document.getElementById("history-list");

container.innerHTML="";

let history=JSON.parse(localStorage.getItem("dispatchHistory"))||[];

history.reverse().forEach(item=>{

const div=document.createElement("div");

div.className="history-card";

div.innerHTML=`
<strong>${item.vehicle}</strong><br>
${item.route}<br>
<small>${item.time}</small>
`;

container.appendChild(div);

});

}
