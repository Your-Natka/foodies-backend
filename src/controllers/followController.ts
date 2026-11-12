import type { Request, RequestHandler, Response } from "express";
import { followUser, listFollows, unfollowUser } from "../services/followService.ts";
import { followPaginationSchema, followUserIdSchema } from "../validators/followValidator.ts";

const readTargetId = (req: Request, res: Response) => {
  const result = followUserIdSchema.safeParse(req.params.id);
  if (result.success) return result.data;
  res.status(400).json({ success: false, message: "Invalid user ID" });
};

const userNotFound = (res: Response) =>
  res.status(404).json({ success: false, message: "User not found" });

const list = (direction: "followers" | "following"): RequestHandler => async (req, res) => {
  const viewerId = req.user!.sub;
  const userId = direction === "followers" ? readTargetId(req, res) : viewerId;
  if (userId === undefined) return;

  const result = followPaginationSchema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.flatMap((issue) => {
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((field) => ({ field, message: "Unknown query parameter" }));
      }
      return [{ field: issue.path.join("."), message: issue.message }];
    });
    res.status(400).json({ success: false, message: "Invalid query parameters", errors });
    return;
  }

  const page = await listFollows(direction, userId, viewerId, result.data);
  if (!page) {
    userNotFound(res);
    return;
  }
  res.status(200).json(page);
};

const changeFollow = (action: "follow" | "unfollow"): RequestHandler => async (req, res) => {
  const viewerId = req.user!.sub;
  const userId = readTargetId(req, res);
  if (!userId) return;

  if (viewerId === userId) {
    res.status(400).json({ success: false, message: "You cannot follow or unfollow yourself" });
    return;
  }

  if (action === "unfollow") {
    if (await unfollowUser(viewerId, userId)) res.status(204).end();
    else userNotFound(res);
    return;
  }

  const result = await followUser(viewerId, userId);
  if (!result) {
    userNotFound(res);
    return;
  }
  res.status(result === "created" ? 201 : 200).json({ data: { userId, isFollowing: true } });
};

export const listFollowers = list("followers");
export const listFollowing = list("following");
export const follow = changeFollow("follow");
export const unfollow = changeFollow("unfollow");
