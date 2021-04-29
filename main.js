/*
  Quippy 1.0 - Programmable bot that serves canned responses
*/

const fs = require('fs');
const Discord = require('discord.js');

const BOT_VERSION = '1.0';
const ADMIN_KEYWORD = '!quippy';
const ADMIN_EXPR = new RegExp(`^${ADMIN_KEYWORD} (.+)`);
const KEYWORD_EXPR = `(^|\\s)!{}($|\\s)`; // NOTE: double escaped

let STATE = {}; // Bot global state; wiped clean if restarted.
let ITEMS = {}; // Stores the data to serve; sync with file system.

const SECRET = process.env.BOT_SECRET;
const DATA_DIR = process.env.BOT_DATA_DIR;

// ================================ //

const rand = (n) => Math.floor(n * Math.random());

const pad = (x) => x < 10 ? '0' + x : x;

const formatDate = (d) => {
  return [
    d.getFullYear(), '-', pad(d.getMonth() + 1), '-', pad(d.getDate()), ' ',
    pad(d.getHours()), ':', pad(d.getMinutes()), ':', pad(d.getSeconds()),
  ].join('');
};

const log = (msg, timestamp) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const dateStr = formatDate(date);
  console.log(`[${dateStr}] ${msg}`);
};

const error = (msg, timestamp) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const dateStr = formatDate(date);
  console.error(`[${dateStr}] ${msg}`);
};

const send = (msg, body) => {
  msg.channel.send(body);
};

const sendTo = (msg, userId, body) => {
  msg.channel.send(`<@!${userId}> ${body}`);
};

const readData = (filename) => {
  const data = readFile(filename);
  if (!data) {
    error(`Failed to read data file: ${filename}`);
    return [];
  }
  // filter out empties
  return data.split(/\r?\n/).filter((x) => x);
};

const writeData = (filename, body, encoding) => {
  if (!encoding) {
    encoding = 'utf8';
  }
  fs.writeFile(filename, body, encoding, (err) => {
    error(`Failed to write out to data file: ${filename}`);
  });
};

const serve = (msg, userId, timestamp, state, items) => {
  // ignore messages from self
  if (userId == client.user.id) {
    return;
  }

  // init per-user
  if (!(userId in state)) {
    state[userId] = {
      'last': null,
    };
  }

  // fancy stragety to avoid duplication... once, at least
  let index = rand(items.length);
  if (items[index] == state[userId]['last']) {
    index = (index + 1 + rand(items.length - 1)) % items.length;
  }
  state[userId]['last'] = items[index];

  // send out the message!
  if (index !== null) {
    send(msg, items[index]);
  }
};

const getFilePath = (key) => {
  return `${DATA_DIR}/${key}`;
};

const addItem = (msg, userId, key, item) => {
  if (!(key in ITEMS)) {
    ITEMS[key] = [item];
    const str = '`' + key + '`';
    sendTo(msg, userId, `created new keyword ${str} and added item.`);
  } else if (ITEMS[key].indexOf(item) != -1) {
    sendTo(msg, userId, 'already in the list.');
    return;
  } else {
    ITEMS[key].push(item);
    sendTo(msg, userId, `added item.`);
  }
  writeData(getFilePath(key), ITEMS[key].join('\n'));
};

const removeItem = (msg, userId, key, id) => {
  if (!(id in ITEMS[key])) {
    sendTo(msg, userId, 'please specify a valid ID.');
    return;
  }

  if (ITEMS[key].length == 1) {
    delete ITEMS[key];
    fs.unlinkSync(getFilePath(key));
    const str = '`' + key + '`';
    sendTo(msg, userId, `removed last item and keyword ${str}.`);
    return;
  } else if (id == ITEMS[key].length - 1) {
    ITEMS[key].pop();
  } else {
    ITEMS[key][id] = ITEMS[key].pop();
  }
  sendTo(msg, userId, `removed item ${id}.`);

  writeData(getFilePath(key), ITEMS[key].join('\n'));
};

const doList = (msg, userId, key) => {
  if (!key) {
    sendTo(msg, userId, `available keywords: ${getListStr()}`);
    return;
  }

  if (!(key in ITEMS)) {
    const str = '`' + key + '`';
    sendTo(msg, userId, `keyword ${str} does not exist.`);
    return;
  }

  // list the items
  const items = ITEMS[key];
  let listMsg = '```';
  for (let i = 0; i < items.length; i++) {
    listMsg += `[${i}] ${items[i]}\n`;
  }
  listMsg += '```';
  sendTo(msg, userId, listMsg);
};

const doAdd = (msg, userId, key, rest) => {
  if (!key) {
    sendTo(msg, userId, 'please specify a keyword.');
    return;
  }

  if (!rest) {
    sendTo(msg, userId, 'please specify an item to add.');
    return;
  }

  addItem(msg, userId, key, rest);
};

const doRemove = (msg, userId, key, id) => {
  if (!key) {
    sendTo(msg, userId, 'please specify a keyword.');
    return;
  }

  if (!id) {
    sendTo(msg, userId, 'please specify the ID of the item to remove.');
    return;
  }

  removeItem(msg, userId, key, id);
};

const hasPrivilege = (msg) => {
  return msg.member.hasPermission('BAN_MEMBERS');
};

const sendUsageInfo = (msg, userId) => {
  let usageMsg = '\n```';
  usageMsg += 'Quippy v' + BOT_VERSION + '\n';
  usageMsg += '~-~-~-~-~-~-~-~\n';
  usageMsg += 'Programmable bot that serves canned responses!\n';
  usageMsg += 'Once you have added a response for a keyword, you can invoke it by putting the keyword in your message preceded by an exclamation mark. For example, if your keyword is "blah", you can put "!blah" in your message. Note that the keyword is case-sensitive.\n\n';

  usageMsg += '!quippy list \u2022 shows list of keywords\n';
  usageMsg += '!quippy list <keyword> \u2022 shows list of responses for the keyword\n';

  if (hasPrivilege(msg)) {
    usageMsg += '\nAdmin commands:\n';
    usageMsg += '!quippy add <keyword> <item> \u2022 adds a response for the keyword\n';
    usageMsg += '!quippy remove <keyword> <id> \u2022 removes a response associated with the keyword\n';
    usageMsg += '!quippy reload \u2022 reloads keywords from the file system\n';
  }
  usageMsg += '```';
  sendTo(msg, userId, usageMsg);
};

const doInfoAndAdmin = (msg, userId, text) => {
  const groups = ADMIN_EXPR.exec(text);
  if (!groups) {
    sendUsageInfo(msg, userId);
    return;
  }

  const cmd = groups[1].split(' ');
  if (cmd[0] === 'reload') {
    if (!hasPrivilege(msg)) {
      sendTo(msg, userId, 'no permission to run this command.');
      return;
    }
    reloadAll();
    sendTo(msg, userId, `loaded keywords: ${getListStr()}`);
  } else if (cmd[0] === 'list') {
    doList(msg, userId, cmd[1]);
  } else if (cmd[0] === 'add') {
    if (!hasPrivilege(msg)) {
      sendTo(msg, userId, 'no permission to run this command.');
      return;
    }
    doAdd(msg, userId, cmd[1], cmd.slice(2).join(' '));
  } else if (cmd[0] === 'remove') {
    if (!hasPrivilege(msg)) {
      sendTo(msg, userId, 'no permission to run this command.');
      return;
    }
    doRemove(msg, userId, cmd[1], cmd[2]);
  } else {
    sendUsageInfo(msg, userId);
  }
};

const getRegexForKey = (key) => {
  // just in case it has a dot
  key = key.replace('.', '\\.');
  return new RegExp(KEYWORD_EXPR.replace('{}', key));
};

const processMsg = (msg) => {
  const user = msg.author;

  let userId;
  let authorStr;

  if (user) {
    authorStr = `${user.username} #${user.id}`;
    userId = user.id;
  } else {
    authorStr = 'unknown';
  }

  // log the message
  const timestamp = msg.createdTimestamp;
  log(`[${authorStr}] ${msg.content}`, timestamp);

  // theoretically not supposed to happen, but just in case
  if (!userId) {
    return;
  }

  const text = msg.content.trim();

  // try to match an expression
  for (key in ITEMS) {
    const expr = getRegexForKey(key);
    if (expr.exec(text)) {
      serve(msg, userId, timestamp, STATE, ITEMS[key])
      return;
    }
  }

  // handle the rest
  if (text.startsWith(ADMIN_KEYWORD)) {
    doInfoAndAdmin(msg, userId, text);
  }
};

const readFile = (filename, encoding) => {
  if (!encoding) {
    encoding = 'utf8';
  }
  try {
    return fs.readFileSync(filename, encoding);
  } catch (err) {
    error(err);
    return null;
  }
};

const getListStr = () => {
  return Object.keys(ITEMS).sort().map(key => '`' + key + '`').join(', ');
};

const reloadAll = () => {
  ITEMS = {};

  if (!fs.existsSync(DATA_DIR)) {
    log('Data directory empty, creating...');
    fs.mkdirSync(DATA_DIR);
    return;
  }

  if (!fs.lstatSync(DATA_DIR).isDirectory()) {
    error('Data directory is a file! Please rename or delete it.');
    return;
  }

  fs.readdirSync(DATA_DIR).forEach(key => {
    ITEMS[key] = readData(`${DATA_DIR}/${key}`);
  });

  log(`Loaded keywords: ${getListStr()}`);
};

// ================================ //

if (!SECRET) {
  error('BOT_SECRET not set! Please set it and restart.');
  process.exit(1);
}

const client = new Discord.Client();

client.on('ready', () => {
  log(`Quippy logged in as ${client.user.tag} with user ID ${client.user.id}`);
  reloadAll();
});

client.on('message', msg => {
  processMsg(msg);
});

client.login(SECRET);
