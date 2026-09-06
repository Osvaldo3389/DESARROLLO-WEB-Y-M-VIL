const mongoose = require('mongoose');
const usuarioSchema = mongoose.Schema({
    nombre: String,
    password: String
});
//para que todos conozca el modelo de usuario
module.exports = mongoose.model('Usuario', usuarioSchema);