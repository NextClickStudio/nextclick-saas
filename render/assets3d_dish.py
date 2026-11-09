# The radio telescope for the moon home, modelled in Blender: a big parabolic dish on a turning yoke with a feed
# horn on a tripod, plus a base with a control hut. Exports yp_dish.glb into public/moon.
import sys, math, os
sys.path.insert(0, "/root/render")
src = open("/root/render/assets3d.py").read()
exec(src[: src.index("# ======================================== the rocket")])  # the helpers only
import bpy, bmesh
from lib import reset, world_gradient, camera, panel

sc = reset()
dish_white = flat("dish_white", (0.86, 0.86, 0.92), metal=0.25, rough=0.3)
steel = pbr("dish_steel", "metal_plate_02", tint=(0.5, 0.5, 0.58), uv_scale=1.5)
dark = flat("dish_dark", (0.06, 0.06, 0.08), metal=0.6, rough=0.4)
green = flat("dish_feed", (0.05, 0.2, 0.1), emit=(0.35, 1.0, 0.6), emit_s=6.0)
parts = []

# the base: a round plinth and a small control hut
parts.append(lathe_uv("plinth", [(0.0, 0.0), (1.5, 0.0), (1.55, 0.08), (1.5, 0.3), (1.3, 0.36), (0.0, 0.36)], segs=48, mat=steel))
parts.append(box("hut", (0.9, 0.7, 0.55), (1.05, 0.9, 0.62), dish_white, w=0.04))
parts.append(box("hut_door", (0.02, 0.3, 0.4), (1.51, 0.9, 0.56), dark, w=0.005))
parts.append(box("hut_light", (0.03, 0.5, 0.06), (1.52, 0.9, 0.86), green, w=0.005))
# the turntable and the yoke
parts.append(lathe_uv("turntable", [(0.0, 0.36), (0.75, 0.36), (0.78, 0.45), (0.7, 0.6), (0.0, 0.6)], segs=40, mat=dark))
for x in (-0.55, 0.55):
    parts.append(box("yoke", (0.16, 0.5, 1.5), (x, 0, 1.3), steel, w=0.03))
# the dish: a shallow paraboloid with a thick rim, tilted up
TILT = math.radians(40)
dish_prof = []
for k in range(25):
    r = 2.1 * k / 24
    dish_prof.append((r, 0.32 * (r / 2.1) ** 2))
dish_prof += [(2.15, 0.34), (2.15, 0.28), (2.05, 0.26)]
for k in range(24, -1, -1):
    r = 2.05 * k / 24
    dish_prof.append((r, 0.32 * (r / 2.1) ** 2 - 0.06))
dish = lathe_uv("dish", dish_prof, segs=72, mat=dish_white)
# panel ribs on the back of the dish
ribs = []
for k in range(12):
    a = k * math.pi / 6
    rib = box(f"rib{k}", (2.0, 0.05, 0.06), (math.cos(a) * 1.05, math.sin(a) * 1.05, -0.06), steel, rot=(0, 0.16, a), w=0.01)
    ribs.append(rib)
# the feed: a tripod of struts meeting at a glowing horn above the dish
feed_parts = []
for k in range(3):
    a = k * 2 * math.pi / 3
    p0 = (math.cos(a) * 1.7, math.sin(a) * 1.7, 0.26)
    p1 = (0, 0, 1.45)
    mid = tuple((p0[i] + p1[i]) / 2 for i in range(3))
    ln = math.dist(p0, p1)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=ln, location=mid, vertices=10)
    st = bpy.context.object
    from mathutils import Vector
    st.rotation_euler = (Vector(p1) - Vector(p0)).to_track_quat("Z", "Y").to_euler()
    st.data.materials.append(steel)
    feed_parts.append(st)
horn = lathe_uv("horn", [(0.0, 1.38), (0.14, 1.38), (0.1, 1.55), (0.16, 1.7), (0.0, 1.7)], segs=24, mat=dark)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0, 0, 1.36))
glow_ball = bpy.context.object
glow_ball.data.materials.append(green)
for rb in ribs:
    bpy.data.objects.remove(rb)
head = [dish] + feed_parts + [horn, glow_ball]
# tilt the head and lift it onto the yoke
pivot = bpy.data.objects.new("dish_head", None)
bpy.context.collection.objects.link(pivot)
for o in head:
    o.parent = pivot
pivot.location = (0, 0, 2.15)
pivot.rotation_euler = (TILT, 0, 0)
pivot.scale = (0.82, 0.82, 0.82)
bpy.context.view_layer.update()
# bake the parenting into the meshes so the export stays one simple static model
for o in head:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
bpy.data.objects.remove(pivot)
parts += head

world_gradient(1.0)
panel("key", (-4, -6, 6), (4, 3), 6, target=(0, 0, 1.6))
panel("rim", (5, 3, 3), (0.6, 6), 9, target=(0, 0, 1.6), color=(0.8, 0.85, 1))
camera((4.5, -6.5, 3.2), (0, 0, 1.5), lens=45)
sc.render.resolution_x, sc.render.resolution_y = 720, 600
sc.cycles.samples = 48
sc.render.filepath = "/root/render/out/yp_dish.png"
bpy.ops.render.render(write_still=True)
export(f"{OUT}/yp_dish.glb", parts)
