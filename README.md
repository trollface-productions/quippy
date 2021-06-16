### Setup

First create the bot in Discord and add to your server:

* Create an application in the Discord developer portal
* Create a bot user
* Under **General Information** find the **Application ID**
* Visit this URL to add the bot to any server you control:
  * `https://discord.com/api/oauth2/authorize?client_id=APPLICATION_ID&permissions=3072&scope=bot`
  * The permissions enabled are "View Channels" and "Send Messages"

Then deploy the bot code:

* Copy the Node.js source file to the desired location on your machine or in the cloud
* Install prereqs with NPM
* Under **Bot** settings in Discord find the **Token** and save this to the `BOT_SECRET` env variable
* Create a directory where data files are stored and save this path to the `BOT_DATA_DIR` env variable
* Fire up the script with `nodemon` or `forever`
* Enjoy!
