const Joi = require('joi');
const User = require('../models/Users')
const bcrypt = require('bcryptjs')
const UserDTO = require('../dto/user');
const JWTService = require('../services/JWTServices');
const RefreshToken = require('../models/token')

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,25}$/;

const authController = {
    async register(req, res, next) { 
        // validate user input
        const userRegisterSchema = Joi.object({
            username: Joi.string().min(5).max(30).required(),
            email: Joi.string().email().required(),
            password: Joi.string().pattern(passwordPattern).required(),
            confirmPassword: Joi.ref('password')
        });

        const {error} = userRegisterSchema.validate(req.body);

        // if error in validation --> return error via middleware

        if(error ){
              return next(error);
        }

        
        // if name and email is already registered  --> return error

        const {username, email, password} = req.body;

         try{

            const emailInUse = await User.exists({email}); 

            const usernameInUse = await User.exists({username});

            if(emailInUse){
                const error = {
                    status :409,
                    message :"Email is already registered, use another, use another email"
                };
                return next(error);
            } 

            if(usernameInUse) {
                const error = {
                     status :409,
                     message :"This name already exists, please try another name"
                };
                return next(error);
            }
        
         } 

       

         catch(error){
            return next(error);
         }

         // password hash

         const hashPassword = await bcrypt.hash(password, 10);

         //store data in database 

         let accessToken ;
         let refreshToken;

         let user;

         try {

            const userToRegister = new User ({
                username,
                email,
                password : hashPassword
             });
    
            user = await userToRegister.save(); 

             //token generation
             accessToken = JWTService.signAccessToken({_id: user._id}, '30m');

             refreshToken = JWTService.signRefreshToken({_id: user._id}, '60m');
            
         } catch (error) {
            return next(error);
         }
         

        await JWTService.storeRefreshToken(refreshToken, user._id);

         res.cookie('accessToken', accessToken, {
            maxAge :1000 * 60 * 60 *24 ,
            httpOnly : true
 
         });

         res.cookie('refreshToken', refreshToken, {
            maxAge  :1000 * 60 * 60 *24,
            httpOnly : true
         })

         const userDto = new UserDTO(user)

         return res.status(201).json({user : userDto, auth: true})


  
    },
    async login (req, res, next) {
        const userLoginSchema = Joi.object ({
            username: Joi.string().min(5).max(30).required(),
            password: Joi.string().pattern(passwordPattern).required(),
        });

        const {error} = userLoginSchema.validate(req.body);

        if(error){
            return next(error);
        } 

        const {username, password} = req.body;

        let user;

        try {
            // match username and password
            user = await User.findOne({username:username});

            if(!user){
                const error = {
                    status: 401,
                    message: "Invalid username or password"
                }
                return next(error)
            }

            // match password
            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword){
                const error = {
                    status: 401,
                    message:"invalid password"
                 }
                 return next(error);
            }

        } catch (error) {
            return next(error)
        } 
         

        const accessToken = JWTService.signAccessToken({_id:user._id}, '30m');

        const refreshToken = JWTService.signRefreshToken({_id: user._id}, '60m');

        // update refreshtoken in db

        try {
            await RefreshToken.updateOne ({
                _id: user._id
            },
            {token: refreshToken},
            {upsert:true}
            )
        } catch (error) {
            return next(error)
        }
        

        res.cookie('accessToken', accessToken, {
            maxAge : 1000 *60 * 60* 24,
            httpOnly: true,
        })

        res.cookie('refreshToken', refreshToken, {
            maxAge : 1000 *60 * 60* 24,
            httpOnly: true,
        })
       



        const userDto = new UserDTO(user)

        return res.status(200).json({user:userDto, auth: true});
    },

    async logout (req, res, next){
        const {refreshToken} = req.cookies;
        try {
            await RefreshToken.deleteOne({
                token:refreshToken
            })
        } catch (error) {
            return next(error)
        }
           
        res.clearCookie('accessToken')
        res.clearCookie('refreshToken')


        res.status(200).json({user: null, auth: false});
    },

    async refresh(req, res, next) {
        const originlaRefreshToken = req.cookies.refreshToken;

         let id;
        try {
            id = JWTService.verifyRefreshToken(originlaRefreshToken)._id;

        } catch (e) {
            const error = {
                status: 401,
                message: 'Unauthorized refresh token'
            }
            return next(error)
        }
        try {
            const match = RefreshToken.findOne({_id: id, token : originlaRefreshToken});

            if(!match){
                const error = {
                    status: 401,
                    message: 'Unauthorized refresh token'
                }
                return next(error)
            }
        } catch (error) {
            return next(error)
        }

        try {
            const accessToken = JWTService.signAccessToken({_id: id}, '30m');

            const refreshToken = JWTService.signRefreshToken({_id: id}, '60m');

            await RefreshToken.updateOne({_id: id}, {token: refreshToken})

            res.cookie('accessToken', accessToken, {

                httpOnly: true, 
                maxAge: 1000 * 60 *60 *24,
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true, 
                maxAge: 1000 * 60 *60 *24,  
            })
        } catch (error) {
           return next(error) 
        }
        
        const user = await User.findOne({_id: id})

        const userDto = new UserDTO(user)

        return res.status(200).json({user: userDto, auth: true});
    }
}

module.exports = authController;