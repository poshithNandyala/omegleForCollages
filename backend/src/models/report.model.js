import mongoose, { Schema } from "mongoose"

const reportSchema = new Schema(
    {
        reporter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        reported: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        reason: { type: String, required: true, enum: ["harassment", "inappropriate", "spam", "underage", "other"] },
        description: { type: String, maxlength: 500 },
        status: { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending" }
    },
    { timestamps: true }
)

export const Report = mongoose.model("Report", reportSchema)
