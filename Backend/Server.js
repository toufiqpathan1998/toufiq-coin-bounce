const express = require('express');
const dbConnect = require('./Database/index');
const {PORT} = require('./Config/index');
const router = require('./routes/index')
const errorHandler = require('./middleware/errorHandler')
const cookieParser = require('cookie-parser');



const app = express();

app.use(cookieParser());

app.use(express.json());

app.use(router)


dbConnect();

app.use('/storage', express.static('storage'));

app.use(errorHandler);

app.listen(PORT, console.log(`BACKEND IS RUNNING ON PORT : ${PORT}`));


