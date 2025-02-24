"use client";
import useSize from "@/hooks/useSize";
import { useEffect, useRef, useState } from "react";
import ToolKit from "./ToolKit";

type Shape = "rect" | "ellipse" | "pencil" | "line" | "selection";
type CurrentShape = Shape | "circle" | "square";

interface Element {
  id: string;
  shape: CurrentShape;
  dimension: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    points: { x: number; y: number }[];
  };
}

function Canvas({ roomId, ws }: { roomId: string; ws: WebSocket }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [shape, setShape] = useState<Shape>("selection");
  const [pan, setPan] = useState({ X: 0, Y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isSelected, setIsSelected] = useState<Element | null>();
  const [newSelectedElem, setNewSelectedElem] = useState<Element | null>();
  const [initialSelectPnt, setInitialSelectPnt] = useState<{
    x: number;
    y: number;
  } | null>();

  const canvasSize = useSize();

  const screenToWorld = (screenX: number, screenY: number) => ({
    x: screenX / zoom + pan.X,
    y: screenY / zoom + pan.Y,
  });

  const worldToScreen = (worldX: number, worldY: number) => ({
    x: (worldX - pan.X) * zoom,
    y: (worldY - pan.Y) * zoom,
  });

  const draw = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    points: { x: number; y: number }[],
    currentShape: CurrentShape
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startScreen = worldToScreen(startX, startY);
    const endScreen = worldToScreen(endX, endY);

    const width = endScreen.x - startScreen.x;
    const height = endScreen.y - startScreen.y;
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    ctx.lineWidth = 2 * zoom;

    if (currentShape === "rect") {
      ctx.strokeRect(startScreen.x, startScreen.y, width, height);
    } else if (currentShape === "square") {
      const absSide = Math.max(absWidth, absHeight);
      ctx.strokeRect(
        startScreen.x,
        startScreen.y,
        Math.sign(width) * absSide,
        Math.sign(height) * absSide
      );
    } else if (currentShape === "ellipse") {
      const absRadiusX = absWidth / 2;
      const absRadiusY = absHeight / 2;
      const centerX = startScreen.x + Math.sign(width) * absRadiusX;
      const centerY = startScreen.y + Math.sign(height) * absRadiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, absRadiusX, absRadiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (currentShape === "circle") {
      const absRadius = Math.max(absWidth, absHeight) / 2;
      const centerX = startScreen.x + Math.sign(width) * absRadius;
      const centerY = startScreen.y + Math.sign(height) * absRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, absRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
    } else if (currentShape === "pencil") {
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      points.forEach(({ x, y }) => {
        const screenPoints = worldToScreen(x, y);
        ctx.lineTo(screenPoints.x, screenPoints.y);
      });
      ctx.stroke();
    }
  };

  const selectDraw = (element: Element) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startScreen = worldToScreen(
      element.dimension.startX,
      element.dimension.startY
    );
    const endScreen = worldToScreen(
      element.dimension.endX,
      element.dimension.endY
    );
    let width = endScreen.x - startScreen.x;
    let height = endScreen.y - startScreen.y;
    let st;
    let end;
    if (width > 0) {
      st = startScreen.x - 5;
      width += 10;
    } else {
      st = startScreen.x + 5;
      width -= 10;
    }
    if (height > 0) {
      end = startScreen.y - 5;
      height += 10;
    } else {
      end = startScreen.y + 5;
      height -= 10;
    }
    ctx.strokeStyle = "#B4B0FF";
    ctx.fillStyle = "#B4B0FF";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(st, end, 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(st + width, end, 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(st, end + height, 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(st + width, end + height, 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.strokeRect(st, end, width, height);
    ctx.strokeRect(st, end, width, height);
    ctx.stroke();
    ctx.strokeStyle = "white";
  };

  const reDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,1)";

    elements.forEach((element) => {
      if (element == newSelectedElem && shape == "selection") {
        selectDraw(element);
      }
      draw(
        element.dimension.startX,
        element.dimension.startY,
        element.dimension.endX,
        element.dimension.endY,
        element.dimension.points,
        element.shape
      );
    });
  };

  function isBetween(number: number, num1: number, num2: number) {
    return (
      number >= Math.min(num1, num2) - 3 && number <= Math.max(num1, num2) + 3
    );
  }

  const isOnBorder = (element: Element, x: number, y: number) => {
    const tolerance = 5; // Adjust as needed, or make it dynamic
    const startScreen = worldToScreen(
      element.dimension.startX,
      element.dimension.startY
    );
    const endScreen = worldToScreen(
      element.dimension.endX,
      element.dimension.endY
    );

    const isBetween = (val, a, b) =>
      val >= Math.min(a, b) - tolerance && val <= Math.max(a, b) + tolerance;

    if (
      shape === "selection" &&
      element === newSelectedElem &&
      isBetween(x, startScreen.x, endScreen.x) &&
      isBetween(y, startScreen.y, endScreen.y)
    ) {
      return true;
    }

    switch (element.shape) {
      case "rect":
      case "square":
        return (
          (isBetween(x, startScreen.x, endScreen.x) &&
            (isBetween(y, startScreen.y, startScreen.y) ||
              isBetween(y, endScreen.y, endScreen.y))) ||
          (isBetween(y, startScreen.y, endScreen.y) &&
            (isBetween(x, startScreen.x, startScreen.x) ||
              isBetween(x, endScreen.x, endScreen.x)))
        );
        case "ellipse":
          // const centerX = (startScreen.x + endScreen.x) / 2;
          // const centerY = (startScreen.y + endScreen.y) / 2;
          // const radiusX = Math.abs(endScreen.x - startScreen.x) / 2;
          // const radiusY = Math.abs(endScreen.y - startScreen.y) / 2;
          // const dx = x - centerX;
          // const dy = y - centerY;
          // const ellipseEquation = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
          // return isBetween(ellipseEquation, 1, 1);
      case "circle":
          const centerXCircle = (startScreen.x + endScreen.x) / 2;
          const centerYCircle = (startScreen.y + endScreen.y) / 2;
          const radiusCircle = Math.max(Math.abs(endScreen.x - startScreen.x), Math.abs(endScreen.y - startScreen.y)) / 2;
          const dxCircle = x - centerXCircle;
          const dyCircle = y - centerYCircle;
          const distanceCircle = Math.sqrt(dxCircle * dxCircle + dyCircle * dyCircle);
          return isBetween(distanceCircle, radiusCircle, radiusCircle);
      case "pencil":
        return element.dimension.points.some((point) => {
          const pointScreen = worldToScreen(point.x, point.y);
          return (
            isBetween(x, pointScreen.x, pointScreen.x) &&
            isBetween(y, pointScreen.y, pointScreen.y)
          );
        });
      case "line":
        // Add line logic here
        return false;
      default:
        return false;
    }
  };

  const sendWS = (type: string, message: any) => {
    ws.send(
      JSON.stringify({
        type,
        payload: { message, roomId },
      })
    );
  };

  useEffect(() => {
    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      switch (type) {
        case "CHAT":
          setElements((prev) => [
            ...prev,
            {
              id: payload.message.id,
              shape: payload.message.shape,
              dimension: {
                startX: payload.message.dimension.startX,
                startY: payload.message.dimension.startY,
                endX: payload.message.dimension.endX,
                endY: payload.message.dimension.endY,
                points: payload.message.dimension.points,
              },
            },
          ]);
          break;
        case "TEMP_CHAT":
          const dimensions = payload.message.dimension;
          reDraw();
          draw(
            dimensions.startX,
            dimensions.startY,
            dimensions.endX,
            dimensions.endY,
            dimensions.points,
            payload.message.shape
          );
          break;
        case "UPDATE_ELEMENT":
          // const oldElement = payload.message.oldElement
          const newElements = elements.map((element) => {
            if (element.id == payload.message.oldElement.id) {
              console.log("hello");
              return {
                ...payload.message.newElement, // Spread new element properties
                dimension: { ...payload.message.newElement.dimension }, // Spread new dimension properties
              };
            }
            // console.log(payload.message)
            return element;
          });
          setElements(newElements);
          break;
        default:
          break;
      }
    };
    return () => {};
  }, [ws, elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    reDraw();

    let startX: number;
    let startY: number;
    let isDrawing = false;
    let points: { x: number; y: number }[] = [];
    let currentShape: CurrentShape = shape;
    let startWorld: { x: number; y: number };
    let endWorld: { x: number; y: number };

    const handleMouseDown = (e: MouseEvent) => {
      if (shape === "selection") {
        let isOnShape = false;
        elements.forEach((element) => {
          if (isOnBorder(element, e.pageX, e.pageY)) {
            isOnShape = true;
            canvas.style.cursor = "move";
            setIsSelected(element);
            setNewSelectedElem(element);
            setInitialSelectPnt(screenToWorld(e.pageX, e.pageY));
            return;
          }
        });
        if (!isOnShape) {
          canvas.style.cursor = "default";
          setIsSelected(null);
          setNewSelectedElem(null);
        }
        return;
      }
      isDrawing = true;
      startX = e.pageX;
      startY = e.pageY;
      points = [];
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (shape === "selection" && !initialSelectPnt) {
        let isOnShape = false;
        // console.log(isSelected);
        elements.forEach((element) => {
          if (isOnBorder(element, e.pageX, e.pageY)) {
            isOnShape = true;
            canvas.style.cursor = "move";
            return;
          }
        });
        if (!isOnShape) canvas.style.cursor = "default";
      }
      if (shape === "selection" && isSelected && initialSelectPnt) {
        const pos = screenToWorld(e.pageX, e.pageY);
        let oldElement = newSelectedElem;
        let newElement;
        const newElements = elements.map((element) => {
          if (element === newSelectedElem) {
            newElement = {
              ...element,
              dimension: {
                ...element.dimension,
                startX:
                  isSelected.dimension.startX + (pos.x - initialSelectPnt.x),
                startY:
                  isSelected.dimension.startY + (pos.y - initialSelectPnt.y),
                endX: isSelected.dimension.endX + (pos.x - initialSelectPnt.x),
                endY: isSelected.dimension.endY + (pos.y - initialSelectPnt.y),
              },
            };
            console.log("isSelected: ", isSelected);
            console.log("initialSelectPnt: ", initialSelectPnt);
            console.log("newSelectedElem: ", newSelectedElem);
            console.log("e: ", e.pageX, e.pageY);
            setNewSelectedElem(newElement);
            return newElement;
          }
          return element;
        });
        sendWS("UPDATE_ELEMENT", { oldElement, newElement });
        setElements(newElements);
      }
      if (isDrawing) {
        reDraw();

        const endX = e.pageX;
        const endY = e.pageY;
        startWorld = screenToWorld(startX, startY);
        endWorld = screenToWorld(endX, endY);
        if (shape === "pencil") {
          points.push({
            x: endWorld.x + Math.random() * 2 - 1,
            y: endWorld.y + Math.random() * 2 - 1,
          });
        }
        draw(
          startWorld.x,
          startWorld.y,
          endWorld.x,
          endWorld.y,
          points,
          currentShape
        );
        const message = {
          shape: currentShape,
          dimension: {
            startX: startWorld.x,
            startY: startWorld.y,
            endX: endWorld.x,
            endY: endWorld.y,
            points: points,
          },
        };
        sendWS("TEMP_CHAT", message);
      }
    };

    const handleMouseUpAndOut = (e: MouseEvent) => {
      if (shape === "selection") {
        setInitialSelectPnt(null);
      }
      if (isDrawing) {
        const endX = e.pageX;
        const endY = e.pageY;
        startWorld = screenToWorld(startX, startY);
        endWorld = screenToWorld(endX, endY);
        const width = endWorld.x - startWorld.x;
        const height = endWorld.y - startWorld.y;
        const absWidth = Math.abs(width);
        const absHeight = Math.abs(height);
        if (currentShape === "square" || currentShape === "circle") {
          const absSide = Math.max(absWidth, absHeight);
          endWorld.x = startWorld.x + Math.sign(width) * absSide;
          endWorld.y = startWorld.y + Math.sign(height) * absSide;
        } else if (currentShape === "pencil") {
          points.forEach((point) => {
            endWorld.x = Math.max(point.x, endWorld.x);
            endWorld.y = Math.max(point.y, endWorld.y);
          });
        }
        const message = {
          id: `${Date.now()}_${Math.random()}`,
          shape: currentShape,
          dimension: {
            startX: startWorld.x,
            startY: startWorld.y,
            endX: endWorld.x,
            endY: endWorld.y,
            points: points,
          },
        };
        setElements((prev) => [...prev, message]);
        sendWS("CHAT", message);
        isDrawing = false;
      }
    };

    const handleShiftDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        if (shape === "ellipse") {
          currentShape = "circle";
        } else if (shape === "rect") {
          currentShape = "square";
        }
        if (!isDrawing) return;
        reDraw();
        draw(
          startWorld.x,
          startWorld.y,
          endWorld.x,
          endWorld.y,
          points,
          currentShape
        );
        const message = {
          shape: currentShape,
          dimension: {
            startX: startWorld.x,
            startY: startWorld.y,
            endX: endWorld.x,
            endY: endWorld.y,
            points: points,
          },
        };
        sendWS("TEMP_CHAT", message);
      }
    };

    const handleShiftUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        currentShape = shape;
        if (!isDrawing) return;
        reDraw();
        draw(
          startWorld.x,
          startWorld.y,
          endWorld.x,
          endWorld.y,
          points,
          currentShape
        );
        const message = {
          shape: currentShape,
          dimension: {
            startX: startWorld.x,
            startY: startWorld.y,
            endX: endWorld.x,
            endY: endWorld.y,
            points: points,
          },
        };
        sendWS("TEMP_CHAT", message);
      }
    };

    let lastScrollTime = 0;
    const scrollThrottle = 16; // ~60fps
    const minScrollDelta = 0;
    const scaleFactor = 0.9;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const now = performance.now();
      if (now - lastScrollTime < scrollThrottle) return;
      lastScrollTime = now;
      if (
        Math.abs(e.deltaX) < minScrollDelta &&
        Math.abs(e.deltaY) < minScrollDelta
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        // Handle pinch-to-zoom separately
        if ((zoom < 0.1 && e.deltaY > 0) || (zoom > 30 && e.deltaY < 0)) return;
        const newZoom = zoom + -e.deltaY * (zoom * 0.01); //for fast zoom at higher zoom levels
        const zoomFactor = newZoom / zoom;

        // Bcoz earlier calculation was startX = e.pageX + (element.startX - e.pageX) * zoomFactor,
        // And now looking using windowToScreen and Pan we get formula :
        // startX = (worldX + pan) * zoom
        //        = element.startX * zoomFactor - (pan * zoom)
        //        = element.startX * zoomFactor - (e.pageX * (zoomFactor - 1) / newZoom * zoom)
        //        = element.startY * zoomFactor + e.pageX * (zoomFactor - 1)
        setPan((prev) => ({
          X: prev.X + (e.pageX * (zoomFactor - 1)) / newZoom,
          Y: prev.Y + (e.pageY * (zoomFactor - 1)) / newZoom,
        }));
        setZoom(newZoom);
      } else {
        // Throttle scroll events
        const deltaX = e.deltaX * scaleFactor;
        const deltaY = e.deltaY * scaleFactor;

        setPan((prev) => ({
          X: prev.X + deltaX / zoom,
          Y: prev.Y + deltaY / zoom,
        }));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUpAndOut);
    canvas.addEventListener("mouseout", handleMouseUpAndOut);
    window.addEventListener("keydown", handleShiftDown);
    window.addEventListener("keyup", handleShiftUp);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUpAndOut);
      canvas.removeEventListener("mouseout", handleMouseUpAndOut);
      window.removeEventListener("keydown", handleShiftDown);
      window.removeEventListener("keyup", handleShiftUp);
    };
  }, [
    elements,
    canvasSize,
    zoom,
    pan,
    shape,
    isSelected,
    initialSelectPnt,
    newSelectedElem,
  ]);

  return (
    <>
      <div className="relative">
        <div className={`fixed w-full h-full left-0 top-0`}>
          <canvas
            ref={canvasRef}
            height={canvasSize?.height || 0}
            width={canvasSize?.width || 0}
          />
        </div>
        <div className="fixed left-0 top-10">
          <ToolKit
            setShape={setShape}
            setNewSelectedElem={setNewSelectedElem}
            canvas={canvasRef.current}
          />
        </div>
      </div>
    </>
  );
}

export default Canvas;
