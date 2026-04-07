import mongoose from 'mongoose';
import { connectDBClientes } from '../db.js';

const trackingAccessSchema = new mongoose.Schema({
    codigo6: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        minlength: 6,
        maxlength: 6
    },
    clientId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    taskId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proyecto',
        default: null
    },
    enabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

trackingAccessSchema.index(
    { codigo6: 1, enabled: 1 },
    {
        unique: true,
        partialFilterExpression: { enabled: true }
    }
);

trackingAccessSchema.index({ projectId: 1 });
trackingAccessSchema.index({ taskId: 1 });
trackingAccessSchema.index({ clientId: 1 });

const TrackingAccessModel = connectDBClientes.models && connectDBClientes.models.TrackingAccess
    ? connectDBClientes.model('TrackingAccess')
    : connectDBClientes.model('TrackingAccess', trackingAccessSchema);

export default TrackingAccessModel;
