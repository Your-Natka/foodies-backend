import { Router, type RequestHandler } from "express";
import { follow, listFollowers, listFollowing, unfollow } from "../controllers/followController.ts";
import { authenticate } from "../middlewares/authMiddleware.ts";

const router = Router();
const privateRoute: RequestHandler[] = [
  (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  },
  authenticate,
];

router.get("/following", privateRoute, listFollowing);
router.get("/:id/followers", privateRoute, listFollowers);
router.put("/:id/follow", privateRoute, follow);
router.delete("/:id/follow", privateRoute, unfollow);

export default router;
