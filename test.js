const config = require('./config.json');
const Discord = require('discord.js');
const client = new Discord.Client();

client.on('message', message => {
    console.log("message", message.content);
})

client.login(config.client_token);