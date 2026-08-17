/* ============================================================
 *  Liz Chat Backend — models/conversation.js
 *  Model da conversa (thread do chat). Cada conversa pertence
 *  a um usuário (userId = uid do Firebase Auth).
 * ============================================================ */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING(64),
    allowNull: true, // conversas antigas (pré-auth) ficam órfãs/invisíveis
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
    // O índice de userId é criado no ensureSchema() do server.js —
    // sync() tentaria criá-lo antes da coluna existir em bancos antigos.
  ],
});

module.exports = Conversation;
