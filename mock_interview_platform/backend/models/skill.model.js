// backend/models/skill.model.js
import mongoose from "mongoose";

const SkillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "General" } // e.g., "Programming", "Soft Skills"
  },
  { timestamps: true }
);

const Skill = mongoose.model("Skill", SkillSchema);
export default Skill; // This exports the Mongoose model as a default export