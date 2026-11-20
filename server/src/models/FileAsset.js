import mongoose from "mongoose";

const fileAssetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    key: { type: String, required: true, unique: true },
    contentType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true, min: 1, max: 25 * 1024 * 1024 },
  },
  { timestamps: true },
);

fileAssetSchema.index({ workspace: 1, project: 1, createdAt: -1 });

export default mongoose.model("FileAsset", fileAssetSchema);
