const loginForm = document.getElementById("login-form");
var jwt = localStorage.getItem("jwt");
var channel = null;


function jwtIsExpire(token) {
    var payload = getDecodejwt(token)
    var datenow = Math.floor(Date.now() / 1000);

    return payload.exp < datenow;
}

function getDecodejwt(token) {
    if (!token)
        return null;

    var jwtSplitted = token.split('.');
    var payload = JSON.parse(atob(jwtSplitted[1]));

    return payload;
}

function logout() {
    jwt = "";
    //  ta bort chatt också
    channel = null;
    localStorage.removeItem("jwt");
    document.getElementById("login-form").style.display = "block";
    document.getElementById("user-details").style.display = "none";
    document.getElementById("chatbox").style.display = "none";
    document.getElementById("channel-create").style.display = "none";
    showChannels();
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = loginForm.elements.username.value;
    const password = loginForm.elements.password.value;

    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    const data = await response.text();

    if (response.status == 401) {
        console.log("wrong pass")
    }
    else if (!data || data.error) {
        console.error(data.error);
    } else {
        localStorage.setItem('jwt', data);
        jwt = localStorage.getItem("jwt");
        showLoggedIn();
    }
});

function showLoggedIn() {
    var userdetails = document.getElementById("user-details");
    userdetails.style.display = "block";
    var h3 = userdetails.querySelector("h3");
    h3.innerText = 'logged in: ' + getDecodejwt(jwt).username;
    document.getElementById("login-form").style.display = "none";
    document.getElementById("channel-create").style.display = "block";
    document.getElementById("chatbox").style.display = "none";
    showChannels();
}

function showChatmessages() {
    if (!channel) {
        return;
    }

    var ul = document.getElementById("chat-messages");
    ul.style.display = "block";
    var jwt = localStorage.getItem("jwt");

    fetch("http://localhost:3000/channels/" + channel.id + "/messages", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": jwt ? "Bearer " + jwt : ""
        }
    })
        .then(response => response.json())
        .then(messages => {
            ul.innerHTML = "";
            messages.forEach(message => {
                var li = document.createElement("li");
                li.innerHTML = '<b>(' + new Date(message.postDate).toLocaleString() + ') ' + message.username + ':</b> ' + message.text;
                ul.appendChild(li);
            });

        })
        .catch(error => {
            console.log(error)
        });
}

function joinChannel(joinedChannel) {
    if (joinedChannel) {
        channel = JSON.parse(atob(joinedChannel));

        var chatbox = document.getElementById("chatbox");
        chatbox.style.display = "block";
        var h2 = chatbox.querySelector("h2");
        h2.innerText = channel.channelname + ' chatt';
        showChatmessages();
    }


}

async function showChannels() {

    const jwt = localStorage.getItem("jwt");
    const ul = document.getElementById("channels");
    ul.innerHTML = "";

    fetch("http://localhost:3000/channels", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            'Authorization': jwt ? 'Bearer ' + jwt : ''
        }
    })
        .then(response => response.json())
        .then(channels => {
            channels.forEach(channel => {
                var li = document.createElement("li");
                var private = channel.private && (!jwt || !channel.members.some(item => item === getDecodejwt(jwt)?.userId));


                li.innerHTML = channel.channelname + (private ? "- Private" : "");
                if (!private) {
                    //btoa(JSON.stringify(channel))  Uncaught SyntaxError: Unexpected identifier 'Object
                    li.innerHTML += '<button onclick="joinChannel(\'' + btoa(JSON.stringify(channel)) + '\')">Join</button>'
                }
                ul.appendChild(li);
            });

        })
        .catch(error => {
            console.error(error);
        });
}

function createChannel() {
    var input = document.getElementById("channel-create-name");
    var checkbox = document.getElementById("channel-create-private")

    var endpoint = "http://localhost:3000/channels/" + input.value + "?isPrivate=" + checkbox.checked;
    var jwt = localStorage.getItem("jwt");

    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Authorization': jwt ? 'Bearer ' + jwt : ''
        }
    })
        .then(response => response.text())
        .then(data => {
            showChannels();
        })

        .catch(error => {
            console.error(error);
        });



}

function sendmessage() {
    var textmessage = document.getElementById("chat-message-input").value;

    if (textmessage && channel) {
        var endpoint = "http://localhost:3000/channels/" + channel.id + "/messages";
        var jwt = localStorage.getItem("jwt");
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': jwt ? 'Bearer ' + jwt : ''
            },
            body: JSON.stringify({
                text: textmessage
            })
        })
            .then(response => response.text())
            .then(data => {
                showChatmessages();
            })
            .catch(error => {
                console.error(error);
            });
    }

}

if (!jwt || jwtIsExpire(jwt)) {
    logout();

} else {
    showLoggedIn()
}

// för  visa nya medelande från andra
let refreshchat = setInterval(function () {
    if (channel) {
        showChatmessages();
    }
}, 3000);
