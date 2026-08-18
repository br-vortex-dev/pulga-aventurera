/* ============================================================
 *  Liz Chat Backend — models/message.js
 *  Model de cada mensagem (user/assistant) dentro de uma conversa.
 * ============================================================ */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'conversations',
      key: 'id',
    },
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // Metadados do arquivo anexado (o conteúdo mora no storage — B2).
  // Formato: { uploadId, name, size, type }.
  file: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'messages',
  indexes: [
    { fields: ['conversationId'] },
    { fields: ['conversationId', 'createdAt'] },
  ],
});

module.exports = Message;
