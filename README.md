

In this project: A cloned P5-MULTIPLAYER-GAME-STARTER template for a simple web game. A @public/prototype.html demo single player html showcasing came physics, ui, and world in it's simplest form.

The Current goal is to translate the simple prototype into this MULTIPLAYER-GAME-STARTER to create a very simple multiplayer game: 

1. Join website. Presented with a name enter box in center screen over blurred backround of live field. Once user enters name, He is loaded in game as a square and begins playing. In short, a working prototype that will be hosted on render.com, with no need for seperate big scale features like multiple rooms.




### ReadMe P5-MULTIPLAYER-GAME-STARTER from GitHub: 

A p5/node.js/express/socket.io starter to allow you to quickly develop multiplayer games</h4>




A very simple way to kick-start your multiplayer game development using express, socket.io and p5.js. It represents an opinionated approach to multiplayer game development which should allow you to skip the laborious beginning boiler-plate steps. Please check out my blog https://codeheir.com/2019/05/11/how-to-code/ for more information on the repository and how to code multiplayer games!

## How to use
1. `git clone https://github.com/LukeGarrigan/p5-multiplayer-game-start.git`
2. `npm install` in the root directory
3. `npm start` to get it running!

## Details 
The project is very simple, it sets up a client `Player` class and a server `Player`. Every 16ms the server emits the current state of the game to the client. If a new client joins the server a new `Player` will be added to the game and displayed on all clients, it also automatically removes players when they leave the game. These are the standard features I frequently have to reproduce when creating a new multiplayer game, so I hope you find this as useful as I do!

## Demo

### Player one joins
![Player one joins](https://snag.gy/10h6Cs.jpg)


### Player two joins
![Player two joins](https://snag.gy/JpebEm.jpg)

### Player two leaves
![Player two joins](https://snag.gy/10h6Cs.jpg)
