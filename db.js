// TODO: Encrypt data at rest

const fs = require('fs');
const crypto = require("crypto")



function save(name, data) {
    fs.writeFileSync("./data/" + name, JSON.stringify(data, null, 4));
}

function read(name) {
    return JSON.parse(fs.readFileSync("./data/" + name));
}

function set(name, key, value) {
    let data = read(name);
    const i = data.findIndex(x => x.id === key);
    console.log("index of key", name, key, i);
    if (i > -1) { 
        data[i] = value;
        save(name, data);
    } else {
        console.log("New key made", name, key);
        value.id = key;
        data.push(value);
        save(name, data);
    }

}

exports.users = {
    get : function(id) { 
        return read('users.json').find(user => user.id == id);
    },
    set : function(id, user) {
        set('users.json', id, user);
    },
    search : function(name) {
        return read('users.json').filter(user => user.name.toLowerCase().includes(name.toLowerCase()));
    },
    getAll : function() {
        return read('users.json');
    }
};

exports.players = { 
    get : function(id) {
        return read('players.json').find(player => player.id === id);
    },
    set : function(id, player) {
        set('players.json', id, player);
    },
    search : function(name) {
        return read('players.json').filter(player => player.name.toLowerCase().includes(name.toLowerCase()));
    },
    getAll : function() {
        return read('players.json');
    },
    create : function(player) {
        const id = crypto.randomUUID();
        player.id = id;
        player.register = { weapons: [], vehicles: [] }
        player.license = {
            id: makeSerial(),
            expiry: +new Date() + (1000 * 60 * 60 * 24 * 30),
            status: "valid",
            type: "license",
            restrictions: []
        };
        player.metadata = {
            deleted: false,
            created: +new Date(),
            updated: +new Date()
        };
        set('players.json', id, player);
        return player;
    }
};

exports.registry = {
    vehicles: {
        get: function(id) {
            return read('vehicles.json').find(vehicle => vehicle.id === id);
        },
        set: function(id, vehicle) {
            set('vehicles.json', id, vehicle);
        },
        getAll: function() {
            return read('vehicles.json')
        },
        create: function(vehicle) {
            vehicle.id = crypto.randomUUID();
            set('vehicles.json', vehicle.id, vehicle);
            return vehicle.id;
        }
    },
    weapons: {
        get: function(id) {
            return read('weapons.json').find(weapon => weapon.id === id);
        },
        set: function(id, weapon) {
            set('weapons.json', id, weapon);
        },
        getAll: function() {
            return read('weapons.json');
        },
        create: function(weapon) {
            weapon.id = crypto.randomUUID();
            set('weapons.json', weapon.id, weapon);
            return weapon.id;
        }
    },
}



exports.sessions = {
    get: function(id) {
        return read('sessions.json')[id];
    },
    set: function(id, session) {
        let sessions = read('sessions.json');
        sessions[id] = session;
        save('sessions.json', sessions);
    },
    check: function(id) {
        if (id) {
            const session = read('sessions.json')[id];
            if (session) {
                if (session.accept && (session.expires > +new Date()) && session.user) {
                    return session;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    },
    create: function(user) {
        const id = crypto.randomBytes(64).toString("hex");
        const session = {
            id, user,
            accept: true,
            expires: +new Date() + 2592000000,
        }
        this.set(id, session);
        return id;
    },
    delete: function(id) {
        let sessions = read('sessions.json');
        delete sessions[id];
        save('sessions.json', sessions);
    }
}


function makeSerial() {
    let serial = "";
    for (let i = 0; i < 8; i++) {
        serial += Math.floor(Math.random() * 10);
    }
    return serial;
};