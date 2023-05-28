class UserDTO {
    constructor(user){
        this._id = user._id;
        this.username = user.username;
        this.emial = user.email;
    }
}

module.exports = UserDTO;