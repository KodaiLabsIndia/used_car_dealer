import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, PanResponder, Pressable, ScrollView, View } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import {
  componentAnchor,
  clusterInspectionPoints,
  orbitPose,
  type Point,
} from "../application/inspection-spatial";
import { inspectionPartName } from "../application/inspection-parts";
import { Button, Text, s } from "./ui";
import { colors } from "@arihant/design-tokens";
export type ViewName = "front" | "rear" | "left" | "right" | "top" | "below";
const views: Record<ViewName, Point> = {
  front: [5, 2.8, 6],
  rear: [-5, 2.8, -6],
  left: [7, 2.3, 0.3],
  right: [-7, 2.3, 0.3],
  top: [0.1, 7, 0.1],
  below: [4, -2.8, 5],
};
type Pose = ReturnType<typeof orbitPose> & { manual: boolean };
type Dot = { id: string; x: number; y: number };
const models = {
  sedan: require("../../assets/inspection-models/sedan.json"),
  hatchback: require("../../assets/inspection-models/hatchback.json"),
  suv: require("../../assets/inspection-models/suv.json"),
};
function OrbitCamera({
  view,
  pose,
  invalidateRef,
  reduced,
  components,
  family,
  onProject,
  presetRequest,
}: {
  view: ViewName;
  pose: React.RefObject<Pose>;
  invalidateRef: React.RefObject<() => void>;
  reduced: boolean;
  components: string[];
  family: string;
  onProject: (dots: Dot[]) => void;
  presetRequest: number;
}) {
  const { camera, invalidate, size } = useThree();
  const focus = useMemo(() => new THREE.Vector3(0, 0.8, 0), []),
    target = useMemo(() => new THREE.Vector3(), []),
    spherical = useMemo(() => new THREE.Spherical(), []);
  const previous = useRef("");
  useEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = () => {};
    };
  }, [invalidate, invalidateRef]);
  useEffect(() => {
    spherical.setFromVector3(new THREE.Vector3(...views[view]).sub(focus));
    Object.assign(
      pose.current,
      orbitPose(spherical.theta, spherical.phi, spherical.radius),
      { manual: false },
    );
    if (reduced)
      camera.position.copy(target.setFromSpherical(spherical).add(focus));
    camera.lookAt(focus);
    invalidate();
  }, [
    view,
    presetRequest,
    reduced,
    camera,
    focus,
    invalidate,
    pose,
    spherical,
    target,
  ]);
  useEffect(() => {
    invalidate();
  }, [components, family, invalidate]);
  useFrame((_state, delta) => {
    const p = pose.current;
    spherical.set(p.radius, p.phi, p.theta);
    target.setFromSpherical(spherical).add(focus);
    const moving = camera.position.distanceTo(target) > 0.002;
    if (p.manual || reduced || !moving) camera.position.copy(target);
    else camera.position.lerp(target, Math.min(1, delta * 14));
    camera.lookAt(focus);
    camera.updateMatrixWorld();
    // Keep clustered native press targets mounted for the entire gesture.
    // Replacing the touched child can cancel a drag that began on a red dot.
    if (p.manual) {
      if (moving) invalidate();
      return;
    }
    const dots: Dot[] = [];
    for (const id of components) {
      const anchor = new THREE.Vector3(...componentAnchor(id, family));
      const side = id.includes("left") ? 1 : id.includes("right") ? -1 : 0;
      if (side && (camera.position.x - anchor.x) * side < -0.05) continue;
      if (
        (id.includes("rear_bumper") || id.includes("tailgate")) &&
        camera.position.z > 0
      )
        continue;
      if (
        (id.includes("front_bumper") || id === "vehicle") &&
        camera.position.z < 0
      )
        continue;
      const projected = anchor.project(camera);
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1
      )
        continue;
      dots.push({
        id,
        x: Math.round(((projected.x + 1) / 2) * size.width * 10) / 10,
        y: Math.round(((1 - projected.y) / 2) * size.height * 10) / 10,
      });
    }
    const signature = JSON.stringify(dots);
    if (signature !== previous.current) {
      previous.current = signature;
      onProject(dots);
    }
    if (moving) invalidate();
  });
  return null;
}
function CarAsset({ family }: { family: string }) {
  const object = useMemo(
    () =>
      new THREE.ObjectLoader().parse(
        models[family as keyof typeof models] || models.suv,
      ),
    [family],
  );
  useEffect(
    () => () =>
      object.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.geometry.dispose();
          for (const m of Array.isArray(n.material) ? n.material : [n.material])
            m.dispose();
        }
      }),
    [object],
  );
  return <primitive object={object} />;
}
export default function InspectionCarScene({
  family,
  active,
  components,
  onSelect,
  view,
  reduced,
  hi,
  presetRequest,
  onOrbit,
}: {
  family: string;
  active: string;
  components: string[];
  onSelect: (id: string) => void;
  view: ViewName;
  reduced: boolean;
  hi: boolean;
  presetRequest: number;
  onOrbit: () => void;
}) {
  const [dots, setDots] = useState<Dot[]>([]);
  const [dragging, setDragging] = useState(false);
  const [parts, setParts] = useState<string[]>([]);
  const clusters = useMemo(() => clusterInspectionPoints(dots), [dots]);
  const pose = useRef<Pose>({ ...orbitPose(0.7, 1.2, 8), manual: false }),
    invalidateRef = useRef(() => {});
  const start = useRef({ theta: 0, phi: 0, radius: 8, pinch: 0 });
  const project = useCallback((next: Dot[]) => setDots(next), []);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.hypot(g.dx, g.dy) > 6,
        onMoveShouldSetPanResponder: (_e, g) => Math.hypot(g.dx, g.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, g) => {
          setDragging(true);
          onOrbit();
          start.current = {
            theta: pose.current.theta + g.dx * 0.009,
            phi: pose.current.phi + g.dy * 0.009,
            radius: pose.current.radius,
            pinch: 0,
          };
          pose.current.manual = true;
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (touches.length > 1) {
            const a = touches[0]!,
              b = touches[1]!;
            const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!start.current.pinch) {
              start.current.pinch = d;
              start.current.radius = pose.current.radius;
            }
            if (d > 0)
              Object.assign(
                pose.current,
                orbitPose(
                  pose.current.theta,
                  pose.current.phi,
                  (start.current.radius * start.current.pinch) / d,
                ),
              );
          } else
            Object.assign(
              pose.current,
              orbitPose(
                start.current.theta - g.dx * 0.009,
                start.current.phi - g.dy * 0.009,
                pose.current.radius,
              ),
            );
          pose.current.manual = true;
          invalidateRef.current();
        },
        onPanResponderRelease: () => {
          pose.current.manual = false;
          setDragging(false);
          invalidateRef.current();
        },
        onPanResponderTerminate: () => {
          pose.current.manual = false;
          setDragging(false);
          invalidateRef.current();
        },
      }),
    [onOrbit],
  );
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Canvas
        frameloop="demand"
        camera={{ position: views.front, fov: 32 }}
        gl={{ antialias: false }}
      >
        <color attach="background" args={["#10151b"]} />
        <ambientLight intensity={1.7} />
        <directionalLight
          position={[5, 7, 4]}
          intensity={3.2}
          color="#fff0dc"
        />
        <directionalLight
          position={[-4, 4, -4]}
          intensity={2.4}
          color="#a7bce0"
        />
        <directionalLight position={[0, 2, 6]} intensity={1} />
        <CarAsset family={family} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.018, 0]}
          scale={[1.4, 2.5, 1]}
        >
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial color="#04070a" transparent opacity={0.5} />
        </mesh>
        <OrbitCamera
          view={view}
          pose={pose}
          invalidateRef={invalidateRef}
          reduced={reduced}
          components={components}
          family={family}
          onProject={project}
          presetRequest={presetRequest}
        />
      </Canvas>
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={{ position: "absolute", inset: 0, opacity: dragging ? 0 : 1 }}
      >
        {clusters.map((d) => (
          <Pressable
            key={d.ids.join(":")}
            accessibilityRole="button"
            accessibilityLabel={
              d.ids.length > 1
                ? `${d.ids.length} ${hi ? "पास के हिस्से, चुनें" : "nearby parts, choose part"}`
                : `${inspectionPartName(d.ids[0]!, hi)}, ${hi ? "जाँच खोलें" : "open checks"}`
            }
            onPress={() =>
              d.ids.length > 1 ? setParts(d.ids) : onSelect(d.ids[0]!)
            }
            style={{
              position: "absolute",
              left: d.x - 22,
              top: d.y - 22,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: d.ids.length > 1 ? 25 : d.ids.includes(active) ? 16 : 12,
                height:
                  d.ids.length > 1 ? 25 : d.ids.includes(active) ? 16 : 12,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#e32939",
                borderWidth: d.ids.includes(active) ? 3 : 2,
                borderColor: d.ids.includes(active) ? "#ffffff" : "#ffadb4",
                shadowColor: "#e32939",
                shadowOpacity: 0.6,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              {d.ids.length > 1 ? (
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 11,
                    lineHeight: 15,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  {d.ids.length}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={parts.length > 0}
        transparent
        animationType="none"
        onRequestClose={() => setParts([])}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000aa",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.black,
              borderRadius: 20,
              padding: 20,
              gap: 14,
              width: "100%",
              maxWidth: 560,
              maxHeight: "80%",
              alignSelf: "center",
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={s.title}>{hi ? "हिस्सा चुनें" : "Choose a part"}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {parts.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  onPress={() => {
                    setParts([]);
                    onSelect(id);
                  }}
                  style={{
                    minHeight: 56,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                    justifyContent: "center",
                  }}
                >
                  <Text>{inspectionPartName(id, hi)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button
              secondary
              label={hi ? "बंद करें" : "Close"}
              onPress={() => setParts([])}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
