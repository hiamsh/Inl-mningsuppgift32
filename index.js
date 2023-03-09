import express from 'express'
import { JSONFile } from 'lowdb/node'
// använd för unik id på databas 
// https://sv.wikipedia.org/wiki/Globally_Unique_Identifier
import { v4 as uuidv4 } from 'uuid';
import { Low } from 'lowdb'
import dotenv from 'dotenv';
//07-encryption
import bcrypt from 'bcrypt';
import cors from 'cors'
dotenv.config();
import jwt from 'jsonwebtoken'

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors())
app.use(express.static('static'))

const adapter = new JSONFile('db.json')
const db = new Low(adapter)
await db.read()
db.data ||= { users: [], channels: [] }

const { users } = db.data
const { channels } = db.data

const verifyJwt = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer) {
        return res.status(401).send('access is denied');
    }

    const token = bearer.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(400).send('token not valid ');
    }
};

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    let user = users.find((x) => x.username === username)

    //skapa användare om det inte finns
    if (!user) {
        bcrypt.hash(password, 10, async (err, hashedPassword) => {
            if (err) {
                return res.status(500).send();
            }
            const id = uuidv4();
            user = { id, username, hashedPassword };
            users.push(user)
            await db.write()
            res.send(getJwt(id, username));
        });
    } 
        // annars användare logga in som normalt
    else {
        bcrypt.compare(password, user.hashedPassword, (err, result) => {
            if (err) {
                return res.status(500).send();
            } else if (!result) {
                return  res.status(401).send('incorrect password');
            }
            res.send(getJwt(user.id, user.username));
        });
    }
});

app.get('/channels/:channelname', verifyJwt, async (req, res) => {
    const { channelname } = req.params;
    const { userId } = req.user;

    if (!channelname) {
        return res.status(400).send('invalid channel name');
    }

    const channel = channels.find((x) => x.channelname === channelname)

    if (!channel){
        return res.status(404).send();
    } else if(!channel.members.includes(userId) && channel.private){
        return res.status(401).send();
    }

    res.send(channel);
});

app.get('/channels/', verifyJwt, async (req, res) => {
    res.send(channels);
});

app.post('/channels/:channelname', verifyJwt, async (req, res) => {
    const { channelname } = req.params;
    const { userId } = req.user;

    // kanal är publik ,om användare skrev inte värde på isPrivate
    let {isPrivate = false} = req.query;

    //måste göra det föratt query blir string
    isPrivate = Boolean(isPrivate=="true")
    if (!channelname) {
        return res.status(400).send('invalid channel name');
    }

    let channel = channels.find((x) => x.channelname === channelname)
    if (channel) {
        return res.status(400).send(`channel already exist ${channelname}`);
    }

    const id = uuidv4();
    channel = { id, channelname, private: isPrivate, members: [userId], messages: [] };
    channels.push(channel)
    await db.write()

    res.send(`channel created ${channelname}`)


});

app.post('/channels/:channelId/messages', verifyJwt, async (req, res) => {
    const { text } = req.body;
    const { userId } = req.user;
    const { channelId } = req.params;

    const user = users.find((x) => x.id === userId)

    if (!user || !text) {
        return res.status(400).send('enter valid userid and message text');
    }

    const messageId = uuidv4();
    let channel = channels.find((x) => x.id === channelId)

    if (!channel) {
        return res.status(404).send(`channel with id ${channelId} is not found`)
    }
    if (!channel.members.includes(userId) && channel.private) {
        return res.status(401);
    }

    channel.messages.push({ id: messageId, text, userId, postDate: new Date(), lastUpdatedDate: new Date(), deleted: false });
    await db.write()
    res.send(`message sent to channel ${channel.channelname}`);
});

app.put('/channels/:channelId/messages/:messageId', verifyJwt, async (req, res) => {
    const { text } = req.body;
    const { userId } = req.user;
    const { channelId, messageId } = req.params;

    const user = users.find((x) => x.id === userId)

    if (!user || !text) {
        return res.status(400).send('enter valid userid and message text');
    }

    let channel = channels.find((x) => x.id === channelId)

    if (!channel) {
        return res.status(404).send(`channel with id ${channelId} is not found`)
    }

    if (!channel.members.includes(userId) && channel.private) {
        return res.status(401);
    }

    let message = channel.messages.find((x) => x.id === messageId)

    if (!message || message.userId != userId) {
        return res.status(404);
    }

    message.text = text;
    message.lastUpdatedDate = new Date();
    await db.write()

        res.send(`message ${messageId} edit success`);
});

app.delete('/channels/:channelId/messages/:messageId', verifyJwt, async (req, res) => {
    const { text } = req.body;
    const { userId} = req.user;
    const {channelId, messageId} = req.params;

    const user = users.find((x) => x.id === userId)

        if (!user || !text) {
        return res.status(400).send('enter valid userid and message text');
    }

    let channel = channels.find((x) => x.id === channelId)

    if (!channel){
        return res.status(404).send(`channel with id ${channelId} is not found`)
    }

    if (!channel.members.includes(userId) && channel.private) {
        return res.status(401);
    }

    let message = channel.messages.find((x) => x.id === messageId)

    if (!message || message.userId != userId) {
        return res.status(404);
    }

    message.deleted=true;
    await db.write()

    res.send(`message ${messageId} delete success`);
});

app.get('/channels/:channelId/messages', verifyJwt, (req, res) => {
    const { userId } = req.user;
    const { channelId } = req.params;
    const user = users.find((x) => x.id === userId)
    const channel = channels.find((x) => x.id === channelId)

    if (!user || !channel) {
        return res.status(400).send()
    }
    // om kanal är privat och användare inte fins i kanal
    if (!channel.members.includes(user.id) && channel.private) {
        return res.status(401).send();
    }

    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
    const messages = channel.messages.map((x) => {
        const member = users.find((user) => user.id === x.userId);
        if (!(channel.private && member && !channel.members.includes(member.id))) {
            return {
                id: x.id,
                text: x.text,
                postDate: x.postDate,
                userId: member.id,
                username: member.username


            };
        }
    });

    res.send(messages);
});

function getJwt(userId, username) {
    const token = jwt.sign({ userId: userId, username }, process.env.JWT_SECRET, {
        expiresIn: '8h',
    });

    return token;
}

app.listen(port, () => {
    console.log(`server listening on port ${port}..`);

});

