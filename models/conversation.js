/* ============================================================
 *  Liz Chat Backend — models/conversation.js
 *  Model da conversa (thread do chat).
 * ============================================================ */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  pinned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'conversations',
  indexes: [
    { fields: ['updatedAt'] },
    { fields: ['pinned'] },
  ],
});

module.exports = Conversation;
