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
  // Indica que a resposta veio do modo demonstração, sem provedor de IA.
  demo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Imagens devolvidas pela IA: referências privadas ou URLs com origem.
  images: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // Links e trechos normalizados de sites consultados pela Liz.
  webResults: {
    type: DataTypes.JSON,
    allowNull: true,
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
