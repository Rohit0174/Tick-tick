//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ =require("lodash");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: "Our little secret.",
  resave:false,
  saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

////////////////////////mongodb connection ////////////////////////////////////////////////
mongoose.connect("mongodb://localhost:27017/todolistDB",{useNewUrlParser : true});

const itemsSchema = {
  name : String
};

const Item = mongoose.model("Item",itemsSchema);

const item1 = new Item({
  name: "Welcome to your todolist!"
});

const item2 = new Item({
  name: "To add a new Item click on + button"
});

const item3 = new Item({
  name: "To Delete a item click on delete button"
});

const defaultItems=[item1,item2,item3];

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List",listSchema)


////////////////////////////////////////////////home route///////////////////////////////////////////////////////
app.get("/", function(req, res) {
  if(!req.isAuthenticated()){
    res.redirect("/front");
  }
Item.find({},function(err,foundItems){

  if(foundItems.length === 0){
    Item.insertMany(defaultItems,function(err){
      if(err)
      console.log(err);
      else {
        console.log("Successfully added items to DataBase!");
      }
    });
    res.redirect("/");
  }else {
    res.render("list", {listTitle: "Today", newListItems: foundItems});
  }

})

});



const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  googleId:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user,done){
  done(null,user.id);
});
passport.deserializeUser(function(id,done){
  User.findById(id,function(err,user){
    done(err,user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/help"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

  app.get('/auth/google/help',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/help');
  });


app.get("/front",function(req,res){
  res.render("front");
})

app.get("/login",function(req,res){
  res.render("login");
})
app.post("/login",function(req,res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user,function(err){
    if(err){
      console.log(err);
    }else {
      passport.authenticate("local")(req,res,function(){
      return  res.redirect("/help");
      });
    }
  })
});


app.get("/register",function(req,res){
  res.render("register");
})
app.post("/register",function(req,res){
  User.register({username: req.body.username},req.body.password, function(err,user){
    if(err){
      console.log(err);
      return res.redirect("/register");
    }else {
      passport.authenticate("local")(req,res,function(){
         res.redirect("/help");
      })
    }
  })
});
app.get("/help",function(req,res){
  if(req.isAuthenticated()){
  return  res.redirect("/");
  }else {
    res.redirect("/login");
  }
})

app.get("/:customListName",function(req,res){
  const customListName = _.capitalize(req.params.customListName);

  List.findOne({name: customListName},function(err,foundList){
    if(!err){
      if(!foundList)
    {
      const list = new List({
        name: customListName,
        items: defaultItems
      });
      list.save();
      res.redirect("/"+customListName);
    }
      else
      {
        res.render("list", {listTitle: foundList.name, newListItems: foundList.items})
      }
    }
  });



})

app.post("/", function(req, res){

const itemName = req.body.newItem;
const listName = req.body.list;

const item = new Item({
  name : itemName
})
if(listName==="Today"){
  item.save();
  res.redirect("/");
}else{
  List.findOne({name: listName},function(err,foundList){
    foundList.items.push(item);
    foundList.save();
    res.redirect("/"+listName);
  })
}

});

app.post("/delete",function(req,res){
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  if(listName==="Today"){
    Item.findByIdAndRemove(checkedItemId,function(err){
      if(err){
        console.log(err);
      }else {
        console.log("Successfully deleted checked item.");
        res.redirect("/");
      }
    });
  }else {
    List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedItemId}}},function(err,foundList){
      if(!err){
        res.redirect("/"+listName);
      }
    })
  }

})


app.get("/about", function(req, res){
  res.render("about");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
