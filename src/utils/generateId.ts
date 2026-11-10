import { ObjectId } from "bson";

export const generateId = () => new ObjectId().toHexString();
