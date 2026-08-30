/* ============================================================
 *  Liz Chat Backend — models/userMemory.js
 *  Ficha de memória do usuário: um texto curto e duradouro
 *  (nome, projetos, gostos, preferências) injetado no prompt
 *  de toda conversa. Ocupa KB — não pesa no armazenamento.
 * ============================================================ */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserMemory = sequelize.define('UserMemory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true, // uma ficha por usuário
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
  },
}, {
  tableName: 'user_memories',
});

module.exports = UserMemory;
