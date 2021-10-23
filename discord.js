const config = require("./config.json");
const fetch = require("node-fetch");

// This is a simple script to get data from the discord API.
// This can be heavily improved, but this is a quick and dirty way to get the job done.


async function sendChannel(id, payload) {
    const request = await fetch(`${config.discord_endpoint}/channels/${id}/messages`,{
        method: "POST",
        headers: {"Authorization": config.client_auth, "Content-Type": "application/json"},
        body: JSON.stringify(payload)
    })
    console.log("Discord Post Message", request.status);
}

exports.sendContent = (channel, message) => {
    return sendChannel(channel, {
        content: message
    })
}

exports.sendEmbed = (channel, embed) => {
    return sendChannel(channel, {
        embeds: [embed]
    })
} 

exports.sendLog = (type, title, message) => {
    if (config.logging) {
        return sendChannel(config.loggingChannel, {
            embeds: [{title, description: message}]
        })
    }
}


exports.getMember = (id) => {
    return new Promise ((resolve, reject) => {
        fetch(`${config.discord_endpoint}/guilds/${config.guild_id}/members/${id}`, {
            headers: {"Authorization": config.client_auth}
        }).then(res => {
            console.log("Discord Member Get", res.status);
            if (res.status === 200) {
                res.json().then(json => {
                    resolve(json);
                }).catch(err => {
                    reject(err);
                })
            } else if (res.status === 404) {
                resolve(null); return;
            } else {
                reject(res);
            }
        })
    })
}