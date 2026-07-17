/**
 * Geometry for hit-testing and dragging rotated layers.
 *
 * Everything here is pure and framework-free so it can be tested without a DOM
 * or a canvas context.
 */

import type { Rect, Size, Vec2 } from "./types";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The centre of a rect. */
export function centreOf(rect: Rect): Vec2 {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Rotate `point` about `origin` by `degrees`.
 *
 * Canvas y grows downward, so a positive angle reads as clockwise on screen --
 * which is what the rotation control in the inspector promises.
 */
export function rotatePoint(point: Vec2, origin: Vec2, degrees: number): Vec2 {
  const angle = toRadians(degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Is `point` inside `rect`, accounting for the rect's rotation?
 *
 * Rather than rotating the rectangle's four corners and running a polygon test,
 * rotate the *point* backwards into the rect's own coordinate space and do a
 * plain axis-aligned comparison. Same answer, a quarter of the arithmetic.
 */
export function hitTest(point: Vec2, rect: Rect, rotation = 0): boolean {
  const local = rotation ? rotatePoint(point, centreOf(rect), -rotation) : point;
  return (
    local.x >= rect.x &&
    local.x <= rect.x + rect.width &&
    local.y >= rect.y &&
    local.y <= rect.y + rect.height
  );
}

/** Scale a size to fit inside `bounds`, never upscaling past 1:1. */
export function fitInside(source: Size, bounds: Size): Size {
  const scale = Math.min(
    bounds.width / source.width,
    bounds.height / source.height,
    1,
  );
  return {
    width: Math.round(source.width * scale),
    height: Math.round(source.height * scale),
  };
}

/** How much to scale `source` so it covers `bounds` entirely. */
export function coverScale(source: Size, bounds: Size): number {
  return Math.max(bounds.width / source.width, bounds.height / source.height);
}
