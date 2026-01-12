"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Re-export the upload middleware from cloudinary.config.ts
// This maintains backward compatibility with existing imports
const cloudinary_config_1 = __importDefault(require("../config/cloudinary.config"));
exports.default = cloudinary_config_1.default;
