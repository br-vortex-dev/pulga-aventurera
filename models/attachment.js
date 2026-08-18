/* ============================================================
 *  Liz Chat Backend — models/attachment.js
 *  Metadados de um arquivo enviado (foto, imagem, documento).
 *  O conteúdo mora no storage (B2/local); aqui fica o mapa
 *  id → chave de storage + dono (userId = uid do Firebase).
 * ============================================================ */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attachment = sequelize.define('Attachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  storageKey: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  contentType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'application/octet-stream',
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'attachments',
  indexes: [
    { fields: ['userId'] },
  ],
});

module.exports = Attachment;
