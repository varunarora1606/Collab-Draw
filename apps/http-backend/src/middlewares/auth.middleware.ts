import { NextFunction, Request } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "@repo/db/client";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const verifyJWT = asyncHandler(async (req: Request, _, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    throw new ApiError(401, "Unauthorized user");
  }

  const decodedToken = jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as JwtPayload;

  const user = await User.findFirst({
    where: { id: decodedToken.id },
    select: { email: true, name: true, id: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  req.user = user;
  next();
});

export { verifyJWT };
