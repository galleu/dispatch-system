const config = require("./config.json");
const fetch = require("node-fetch");
const db = require("./db");

const discord = require('discord.js');
const client = new discord.Client();

client.login(config.client_token);

function sendClientLog(name, message){
    return new Promise(function(resolve, reject){
        const payload = { embeds: [{title: name, description: message, color: 14681495}] };
        fetch(`${config.discord_endpoint}/channels/${config.logging_channel}/messages`,{
            method: "POST",
            headers: {"Authorization": "Bot "+config.client_token, "Content-Type": "application/json"},
            body: JSON.stringify(payload)
        }).then(res => {
            if (!res.ok) {
                console.error("Discord Post Message", request.status);
            }
            resolve(); return;
        });
    });
}


client.once('ready', async () => {
	console.log(`Client Ready ${client.user.tag}`);
});


client.on("message", async message => {
    console.log(message.content);
})

client.on("guildMemberUpdate", async function(oldMember, newMember) {
    console.log(`Guild member update`);

    // Get only the ids of all the new roles
    const newRoleIds = newMember.roles.cache.map(role => role.id);

    const id = newMember.user.id;

    const user = db.users.get(id);
    if (user) {
        user.username = newMember.user.username;
        user.nickname = newMember.nickname || newMember.user.username;
        user.roles = newRoleIds;
        db.users.set(id, user);
    } else {
        await sendClientLog("Warn", `User ${newMember.user.tag} | ${id} Member Update but no account.`);
    }
    await sendClientLog("Event", `${newMember.user.tag} | ${newMember.user.id}`);
    if (config.debug) {
        await sendClientLog("Debug", `${newMember.nickname || newMember.user.username}`);
    }
});


exports.getRoles = (member_id) => {
    const guild = client.guilds.cache.get(config.guild_id);
    return guild.members.cache.get(member_id).roles.cache.map(role => role.id);
}


exports.log = async (name, message) => {
    await sendClientLog(name, message);
}



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