# yeppo home film, take 2: the tech lighthouse on its rock in a night storm, its intro, and the dive into the deep.
# usage: python film2.py <intro|scroll> <first> <last> [step] [samples] [w] [h]
import sys, math, random, time, os, json
sys.path.insert(0, "/root/render")
import bpy, bmesh
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view
from lib import reset, mat, lathe, COIN_PROFILE

part = sys.argv[1]
first, last = int(sys.argv[2]), int(sys.argv[3])
step = int(sys.argv[4]) if len(sys.argv) > 4 else 1
samples = int(sys.argv[5]) if len(sys.argv) > 5 else 24
W = int(sys.argv[6]) if len(sys.argv) > 6 else 960
H = int(sys.argv[7]) if len(sys.argv) > 7 else 540
NI, NS = 60, 120
OUT = os.environ.get("OUT", "/root/render/f2")
os.makedirs(OUT, exist_ok=True)
A = "/root/render/assets"
random.seed(2)

sc = reset()
sc.cycles.samples = samples
sc.cycles.volume_bounces = 1
sc.cycles.volume_step_rate = 5.0
sc.cycles.max_bounces = 8
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.use_persistent_data = True
sc.view_settings.look = "AgX - Punchy"
try:
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
except Exception:
    pass


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def ease(x):
    return 4 * x * x * x if x < 0.5 else 1 - pow(-2 * x + 2, 3) / 2


def seg(f, a, b):
    return ease(clamp((f - a) / (b - a)))


def emit(name, color, s):
    return mat(name, (0, 0, 0), emit=color, emit_s=s)


# ---------------- world: black night sky ----------------
w = bpy.data.worlds.new("night"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
wout = nt.nodes.new("ShaderNodeOutputWorld"); env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(f"{A}/night.hdr")
mp = nt.nodes.new("ShaderNodeMapping"); tcw = nt.nodes.new("ShaderNodeTexCoord"); mp.inputs["Rotation"].default_value[2] = math.radians(150)
wbg = nt.nodes.new("ShaderNodeBackground"); wbg.inputs["Strength"].default_value = 0.035
nt.links.new(tcw.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
nt.links.new(env.outputs[0], wbg.inputs[0]); nt.links.new(wbg.outputs[0], wout.inputs[0])

ROCK = Vector((0, 40, 0))

# ---------------- the sea ----------------
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
sea = bpy.context.object
om = sea.modifiers.new("ocean", "OCEAN")
om.geometry_mode = "GENERATE"; om.size = 1; om.spatial_size = 120; om.resolution = 16
om.wave_scale = 7.0; om.choppiness = 2.2; om.wind_velocity = 34; om.time = 7.0
om.use_normals = True; om.use_foam = True; om.foam_layer_name = "foam"; om.foam_coverage = 0.12
sea.location = (0, 40, 0)
smooth(sea)
sm = bpy.data.materials.new("sea"); sm.use_nodes = True; snt = sm.node_tree; sb = snt.nodes["Principled BSDF"]
sb.inputs["Roughness"].default_value = 0.07; sb.inputs["IOR"].default_value = 1.333
attr = snt.nodes.new("ShaderNodeAttribute"); attr.attribute_name = "foam"
ramp = snt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.55; ramp.color_ramp.elements[1].position = 0.95
mix = snt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
mix.inputs[6].default_value = (0.002, 0.008, 0.011, 1); mix.inputs[7].default_value = (0.25, 0.29, 0.31, 1)
snt.links.new(attr.outputs["Fac"], ramp.inputs["Fac"]); snt.links.new(ramp.outputs["Color"], mix.inputs["Factor"])
snt.links.new(mix.outputs[2], sb.inputs["Base Color"])
sea.data.materials.append(sm)
# the same surface seen from below: bright, rippled, letting light through
under_sea = bpy.data.materials.new("undersea"); under_sea.use_nodes = True
ub = under_sea.node_tree.nodes["Principled BSDF"]; ub.inputs["Transmission Weight"].default_value = 1; ub.inputs["IOR"].default_value = 1.333
ub.inputs["Roughness"].default_value = 0.05; ub.inputs["Base Color"].default_value = (0.6, 0.85, 0.9, 1)

# ---------------- the rock: one solid islet, flat on top where the tower stands ----------------
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1, location=ROCK)
rock = bpy.context.object
tex = bpy.data.textures.new("rockn", "CLOUDS"); tex.noise_scale = 0.35; tex.noise_depth = 4
tex2 = bpy.data.textures.new("rockv", "VORONOI"); tex2.noise_scale = 0.5
for v in rock.data.vertices:
    p = v.co.copy()
    r = 10 + 3.5 * math.sin(p.x * 3.1 + p.y * 1.7) * 0.25 + random.uniform(-0.15, 0.15)
    v.co = Vector((p.x * r, p.y * r * 0.9, p.z * 9))
    if v.co.z > 2.6:  # a level top
        v.co.z = 2.6 + (v.co.z - 2.6) * 0.08
for name, t, s in (("d1", tex, 1.2), ("d2", tex2, 0.6)):
    d = rock.modifiers.new(name, "DISPLACE"); d.texture = t; d.strength = s; d.texture_coords = "GLOBAL"
rock.location = ROCK + Vector((0, 0, 0.6))
smooth(rock)
rm = bpy.data.materials.new("rockm"); rm.use_nodes = True; rn = rm.node_tree; rb = rn.nodes["Principled BSDF"]
tcr = rn.nodes.new("ShaderNodeTexCoord"); mpr = rn.nodes.new("ShaderNodeMapping"); mpr.inputs["Scale"].default_value = (0.18, 0.18, 0.18)
rn.links.new(tcr.outputs["Object"], mpr.inputs["Vector"])
def rtex(f, color=True):
    t = rn.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(f"{A}/cliff_side/{f}.jpg"); t.projection = "BOX"; t.projection_blend = 0.3
    if not color:
        t.image.colorspace_settings.name = "Non-Color"
    rn.links.new(mpr.outputs[0], t.inputs["Vector"]); return t
dk = rn.nodes.new("ShaderNodeMix"); dk.data_type = "RGBA"; dk.blend_type = "MULTIPLY"; dk.inputs["Factor"].default_value = 1.0
dk.inputs[7].default_value = (0.32, 0.33, 0.36, 1)
rn.links.new(rtex("Diffuse").outputs[0], dk.inputs[6]); rn.links.new(dk.outputs[2], rb.inputs["Base Color"])
rn.links.new(rtex("Rough", False).outputs[0], rb.inputs["Roughness"])
nmr = rn.nodes.new("ShaderNodeNormalMap"); nmr.inputs["Strength"].default_value = 1.5
rn.links.new(rtex("nor_gl", False).outputs[0], nmr.inputs["Color"]); rn.links.new(nmr.outputs[0], rb.inputs["Normal"])
rock.data.materials.append(rm)
# under the islet, its root: a column of stone all the way down to the floor, so the dive runs along a wall
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=7.5, depth=46, location=ROCK + Vector((0, 3, -22)))
root_ = bpy.context.object
root_.modifiers.new("sub", "SUBSURF").levels = 3
for name_, t_, s_ in (("r1", tex, 2.2), ("r2", tex2, 1.0)):
    d_ = root_.modifiers.new(name_, "DISPLACE"); d_.texture = t_; d_.strength = s_; d_.texture_coords = "GLOBAL"
root_.data.materials.append(rm); smooth(root_)
# a few scanned rocks at the waterline
def imp(name, loc, scale, rot=(0, 0, 0)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{A}/{name}/{name}.gltf")
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name + "_root", None); bpy.context.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.location, root.scale, root.rotation_euler = loc, (scale,) * 3, rot
    return root
imp("coast_rocks_05", ROCK + Vector((-9, -6, -0.8)), 1.5, (0, 0, math.radians(140)))
imp("coast_rocks_05", ROCK + Vector((8, -7, -0.9)), 1.2, (0, 0, math.radians(260)))

# ---------------- the tower: dark graphite segments, light in the seams ----------------
graphite = mat("graphite", (0.028, 0.03, 0.034), metal=0.75, rough=0.32, coat=0.4)
concrete = mat("concrete", (0.16, 0.16, 0.17), rough=0.8)
seam = emit("seam", (0.75, 0.92, 1.0), 14)
redl = emit("red", (1.0, 0.08, 0.05), 30)
T = ROCK + Vector((0, 0, 3.6))
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=3.0, depth=1.6, location=T + Vector((0, 0, 0.2))); base = bpy.context.object
b = base.modifiers.new("b", "BEVEL"); b.width = 0.08; b.segments = 3; base.data.materials.append(concrete)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=2.55, depth=0.5, location=T + Vector((0, 0, 1.2))); base2 = bpy.context.object
base2.data.materials.append(concrete)
NSEG = 8
SEGH = 1.9
segments = []
for k in range(NSEG):
    z0 = 1.45 + k * (SEGH + 0.12)
    r0 = 2.05 - 0.75 * k / NSEG
    r1 = 2.05 - 0.75 * (k + 1) / NSEG
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r0, radius2=r1 + 0.02, depth=SEGH, location=T + Vector((0, 0, z0 + SEGH / 2)))
    sgo = bpy.context.object
    bv = sgo.modifiers.new("b", "BEVEL"); bv.width = 0.03; bv.segments = 2; bv.limit_method = "ANGLE"
    sgo.data.materials.append(graphite)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r1 - 0.06, depth=0.14, location=T + Vector((0, 0, z0 + SEGH + 0.06)))
    ring = bpy.context.object; ring.data.materials.append(seam)
    # a vertical LED slit on the front of each segment
    bpy.ops.mesh.primitive_cube_add(size=1, location=T + Vector((0, -((r0 + r1) / 2) + 0.01, z0 + SEGH / 2)))
    slit = bpy.context.object; slit.scale = (0.05, 0.05, SEGH * 0.8); slit.data.materials.append(seam)
    slit.rotation_euler = (math.atan2(r0 - r1, SEGH), 0, 0)
    segments.append((sgo, ring, slit, Vector(sgo.location), Vector(ring.location), Vector(slit.location)))
TOPZ = 1.45 + NSEG * (SEGH + 0.12)
G = T + Vector((0, 0, TOPZ))
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=2.0, depth=0.3, location=G + Vector((0, 0, 0.15))); deck = bpy.context.object; deck.data.materials.append(graphite)
bpy.ops.mesh.primitive_torus_add(major_radius=1.95, minor_radius=0.025, major_segments=96, location=G + Vector((0, 0, 0.32))); deckring = bpy.context.object; deckring.data.materials.append(seam)
glass = mat("lglass", (0.85, 0.95, 1.0), rough=0.03, trans=1, ior=1.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1.05, depth=2.0, location=G + Vector((0, 0, 1.3))); lan = bpy.context.object; lan.data.materials.append(glass); lan.visible_shadow = False
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.25, radius2=0.25, depth=0.7, location=G + Vector((0, 0, 2.65))); capo = bpy.context.object; capo.data.materials.append(graphite)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.04, depth=3.2, location=G + Vector((0, 0, 4.6))); mast = bpy.context.object; mast.data.materials.append(graphite)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=G + Vector((0, 0, 6.25))); tip = bpy.context.object; tip.data.materials.append(redl)
L = G + Vector((0, 0, 1.3))
core = emit("core", (1.0, 0.92, 0.78), 0.0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.38, segments=32, ring_count=16, location=L); lamp = bpy.context.object; lamp.data.materials.append(core); lamp.visible_shadow = False
# the beam: two spots back to back, and a glow
spots = []
for k in range(2):
    bpy.ops.object.light_add(type="SPOT", location=L); s = bpy.context.object
    s.data.spot_size = math.radians(6.5); s.data.spot_blend = 0.35; s.data.shadow_soft_size = 0.25; s.data.color = (0.92, 0.95, 1.0)
    spots.append(s)
bpy.ops.object.light_add(type="POINT", location=L); glowl = bpy.context.object; glowl.data.color = (0.9, 0.95, 1.0); glowl.data.shadow_soft_size = 0.4
bpy.ops.object.light_add(type="POINT", location=G + Vector((0, 0, 6.25))); redpt = bpy.context.object; redpt.data.color = (1, 0.1, 0.05); redpt.data.energy = 40
# a cold light behind the tower so its edge reads against the sky
bpy.ops.object.light_add(type="AREA", location=tuple(T + Vector((6, 22, 12)))); bk = bpy.context.object
bk.data.size = 12; bk.data.energy = 7000; bk.data.color = (0.45, 0.6, 1.0); bk.data.volume_factor = 0.0; bk.visible_camera = False
bk.rotation_euler = ((T + Vector((0, 0, 8))) - bk.location).to_track_quat("-Z", "Y").to_euler()

# ---------------- the deep ----------------
DEEP = -42.0
bpy.ops.mesh.primitive_grid_add(x_subdivisions=160, y_subdivisions=160, size=140, location=(0, 50, DEEP))
floor = bpy.context.object
for v in floor.data.vertices:
    x, y = v.co.x, v.co.y
    v.co.z = 1.2 * math.sin(x * 0.12) * math.cos(y * 0.09) + 0.4 * math.sin(x * 0.5 + y * 0.3)
floor.data.materials.append(mat("sand", (0.06, 0.08, 0.09), rough=0.95)); smooth(floor)
for k_, (ox, oy, sc_, rz_) in enumerate([(-12, 10, 3.2, 20), (13, 16, 3.8, 160), (-3, 22, 4.5, 80), (6, -2, 2.0, 300), (-9, -1, 1.6, 200)]):
    imp("coast_rocks_05", Vector((ROCK.x + ox, ROCK.y + oy, DEEP - 0.4)), sc_, (0, 0, math.radians(rz_)))
wreck = imp("dutch_ship_medium", Vector((ROCK.x + 9, ROCK.y + 8, DEEP + 0.8)), 1.0, (0.35, -0.25, math.radians(250)))
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.5, depth=6, location=(ROCK.x - 7, ROCK.y + 4, DEEP + 3)); beacon = bpy.context.object; beacon.data.materials.append(graphite)
beacon_rings = []
for k in range(4):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55, minor_radius=0.03, major_segments=48, location=(ROCK.x - 7, ROCK.y + 4, DEEP + 1 + k * 1.4))
    o = bpy.context.object; o.data.materials.append(seam); beacon_rings.append(o)
bpy.ops.object.light_add(type="POINT", location=(ROCK.x - 7, ROCK.y + 2.5, DEEP + 5)); bl = bpy.context.object; bl.data.energy = 900; bl.data.color = (0.5, 0.85, 1.0)
bpy.ops.object.light_add(type="POINT", location=(ROCK.x + 9, ROCK.y + 4, DEEP + 6)); wl = bpy.context.object; wl.data.energy = 2500; wl.data.color = (0.4, 0.75, 0.9)
bpy.ops.object.light_add(type="POINT", location=(SCHOOL_X := ROCK.x + 1, ROCK.y - 4, DEEP + 12)); sl = bpy.context.object; sl.data.energy = 1500; sl.data.color = (0.6, 0.85, 1.0)
# the rugs, as the sea has them: mines, chained to the bottom, a red light blinking; and jellyfish, lovely and stinging
rust = mat("mine", (0.05, 0.035, 0.03), metal=0.8, rough=0.55)
mines = []
for k, (mx, my, mz) in enumerate([(-4.5, -8, -12), (5, -6, -18), (-2.5, -3, -24), (4, -9, -29), (-6, -5, -33), (1.5, -11, -21), (7, -2, -36)]):
    c = Vector((ROCK.x + mx, ROCK.y + my, mz))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, segments=32, ring_count=16, location=c); body = smooth(bpy.context.object); body.data.materials.append(rust)
    parts = [body]
    for j in range(14):
        dv = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized()
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.07, radius2=0.03, depth=0.32, location=c + dv * 0.62)
        sp = bpy.context.object; sp.rotation_euler = dv.to_track_quat("Z", "Y").to_euler(); sp.data.materials.append(rust); parts.append(sp)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=c + Vector((0, -0.5, 0.25))); led = bpy.context.object; led.data.materials.append(redl); parts.append(led)
    ln_ = c.z - DEEP
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.02, depth=ln_, location=(c.x, c.y, DEEP + ln_ / 2 - 0.3)); ch = bpy.context.object; ch.data.materials.append(rust); parts.append(ch)
    bpy.ops.object.light_add(type="POINT", location=c + Vector((0, -0.6, 0.25))); ml = bpy.context.object; ml.data.color = (1, 0.1, 0.05); ml.data.energy = 60
    mines.append(dict(parts=[(o, Vector(o.location)) for o in parts], led=led, light=ml, c=c, ph=random.random() * 6))
jelly_bell = bpy.data.materials.new("jelly"); jelly_bell.use_nodes = True; jn = jelly_bell.node_tree; jb = jn.nodes["Principled BSDF"]
jb.inputs["Base Color"].default_value = (0.8, 0.6, 1.0, 1); jb.inputs["Transmission Weight"].default_value = 1; jb.inputs["Roughness"].default_value = 0.2
jb.inputs["Emission Color"].default_value = (0.55, 0.4, 1.0, 1)
lwj = jn.nodes.new("ShaderNodeLayerWeight"); lwj.inputs["Blend"].default_value = 0.35
mj = jn.nodes.new("ShaderNodeMath"); mj.operation = "MULTIPLY"; mj.inputs[1].default_value = 6
jn.links.new(lwj.outputs["Facing"], mj.inputs[0]); jn.links.new(mj.outputs[0], jb.inputs["Emission Strength"])
tent = emit("tent", (0.6, 0.45, 1.0), 2.5)
jellies = []
for k in range(10):
    c = Vector((ROCK.x + random.uniform(-9, 9), ROCK.y + random.uniform(-14, 2), random.uniform(-34, -8)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, segments=32, ring_count=16, location=c); bell = smooth(bpy.context.object)
    for v in bell.data.vertices:
        if v.co.z < 0:
            v.co.z *= 0.25
    bell.data.materials.append(jelly_bell)
    parts = [bell]
    for j in range(9):
        a = j / 9 * 6.283
        bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.008, depth=1.6, location=c + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, -0.85)))
        tt = bpy.context.object; tt.rotation_euler = (random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), 0); tt.data.materials.append(tent); parts.append(tt)
    jellies.append(dict(parts=[(o, Vector(o.location)) for o in parts], ph=random.random() * 6, rise=random.uniform(0.02, 0.05)))
# the school: wallets moving together
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8); f0 = bpy.context.object
f0.scale = (0.2, 0.045, 0.07); bpy.ops.object.transform_apply(scale=True); f0.hide_render = True
f0.data.materials.append(mat("fish", (0.8, 0.86, 0.9), metal=1, rough=0.2))
SCHOOL = Vector((ROCK.x + 1, ROCK.y - 2, DEEP + 9))
fish = []
for k in range(220):
    o = bpy.data.objects.new("f", f0.data); bpy.context.collection.objects.link(o)
    fish.append(dict(o=o, t=random.random() * 6.28, r=random.uniform(1.5, 3.2), h=random.gauss(0, 0.7), sp=random.uniform(0.9, 1.1)))
# cold light grazing the wall on the way down, and glowing plankton clinging to it
wall_lights = []
for z_ in (-6, -14, -22, -30):
    bpy.ops.object.light_add(type="AREA", location=(ROCK.x + 9, ROCK.y - 13, z_ + 3)); wl_ = bpy.context.object
    wl_.data.size = 8; wl_.data.energy = 6000; wl_.data.color = (0.35, 0.7, 0.9); wl_.visible_camera = False
    wl_.rotation_euler = (Vector((ROCK.x, ROCK.y - 3, z_)) - wl_.location).to_track_quat("-Z", "Y").to_euler()
    wall_lights.append(wl_)
# marine snow and plankton: particles hanging in the water column, so depth and motion read everywhere
def particles(name, count, size, m, loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); em_ = bpy.context.object; em_.name = name; em_.scale = scale
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size); dot = bpy.context.object; dot.data.materials.append(m); dot.hide_render = True
    ps_ = em_.modifiers.new(name, "PARTICLE_SYSTEM").particle_system.settings
    ps_.count = count; ps_.frame_start = ps_.frame_end = 1; ps_.lifetime = 100000; ps_.emit_from = "VOLUME"; ps_.physics_type = "NO"
    ps_.render_type = "OBJECT"; ps_.instance_object = dot; ps_.particle_size = 1.0; ps_.size_random = 0.7
    em_.show_instancer_for_render = False
    return em_
snow = particles("snow", 9000, 0.022, mat("snowm", (0.8, 0.9, 0.95), rough=0.6, emit=(0.6, 0.85, 1.0), emit_s=0.25), (ROCK.x, ROCK.y - 6, -22), (36, 30, 40))
plank = particles("plank", 1500, 0.03, emit("plankm", (0.3, 0.9, 1.0), 6), (ROCK.x, ROCK.y, DEEP + 8), (40, 34, 16))
plank2 = particles("plank2", 1800, 0.025, emit("plankm2", (0.35, 0.95, 1.0), 8), (ROCK.x, ROCK.y - 4.5, -20), (18, 4, 36))
# underwater light: shafts from the surface with a caustic pattern
bpy.ops.object.light_add(type="SPOT", location=(ROCK.x, ROCK.y - 10, 2)); shaft = bpy.context.object
shaft.data.energy = 0; shaft.data.spot_size = math.radians(55); shaft.data.spot_blend = 0.9; shaft.data.color = (0.55, 0.85, 1.0)
shaft.rotation_euler = (Vector((ROCK.x, ROCK.y - 6, DEEP)) - shaft.location).to_track_quat("-Z", "Y").to_euler()
shaft.data.use_nodes = True; ln = shaft.data.node_tree
vor = ln.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 9
tcl = ln.nodes.new("ShaderNodeTexCoord"); ln.links.new(tcl.outputs["Normal"], vor.inputs["Vector"])
crp = ln.nodes.new("ShaderNodeValToRGB"); crp.color_ramp.elements[0].position = 0.0; crp.color_ramp.elements[0].color = (1, 1, 1, 1)
crp.color_ramp.elements[1].position = 0.1; crp.color_ramp.elements[1].color = (0.2, 0.2, 0.2, 1)
ln.links.new(vor.outputs["Distance"], crp.inputs["Fac"]); ln.links.new(crp.outputs["Color"], ln.nodes["Emission"].inputs["Color"])


# ---------------- air and water volumes ----------------
def volume(name, loc, scale, density, color, aniso, absorb=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); v = bpy.context.object; v.name = name; v.scale = scale
    m = bpy.data.materials.new(name); m.use_nodes = True; n = m.node_tree; n.nodes.remove(n.nodes["Principled BSDF"])
    vs = n.nodes.new("ShaderNodeVolumePrincipled"); vs.inputs["Density"].default_value = density; vs.inputs["Color"].default_value = (*color, 1)
    vs.inputs["Anisotropy"].default_value = aniso
    if absorb:
        vs.inputs["Absorption Color"].default_value = (*absorb, 1)
    n.links.new(vs.outputs[0], n.nodes["Material Output"].inputs["Volume"]); v.data.materials.append(m)
    return v
fog = volume("fog", (0, 40, 22.5), (220, 220, 44), 0.007, (0.7, 0.76, 0.86), 0.7)
mist = volume("mist", (0, 40, 0.8), (220, 220, 1.6), 0.012, (0.55, 0.62, 0.72), 0.4)
water = volume("water", (0, 40, -30), (220, 220, 59), 0.055, (0.22, 0.55, 0.66), 0.8, (0.12, 0.4, 0.55))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 32; cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 11

# ---------------- timing ----------------
HERO_P, HERO_T = Vector((ROCK.x, ROCK.y - 40, 2.6)), T + Vector((0, 0, 9.0))
SKEYS = [
    (0, HERO_P, HERO_T),
    (22, Vector((ROCK.x + 2, ROCK.y - 30, 6)), T + Vector((0, 0, 10))),
    (46, Vector((ROCK.x + 4, ROCK.y - 24, 1.6)), ROCK + Vector((0, 0, 1))),
    (54, Vector((ROCK.x + 4, ROCK.y - 22, 0.05)), ROCK + Vector((0, 2, -6))),
    (60, Vector((ROCK.x + 5, ROCK.y - 16, -3)), ROCK + Vector((-2, -2, -12))),
    (74, Vector((ROCK.x + 6, ROCK.y - 15, -13)), ROCK + Vector((-3, -4, -20))),
    (90, Vector((ROCK.x + 2, ROCK.y - 21, -24)), ROCK + Vector((0, -6, -32))),
    (106, Vector((ROCK.x - 1, ROCK.y - 22, DEEP + 10)), ROCK + Vector((1, 6, DEEP + 3))),
    (119, Vector((ROCK.x, ROCK.y - 19, DEEP + 8.5)), ROCK + Vector((1, 6, DEEP + 2.5))),
]


def cam_at(f):
    i = 1
    while i < len(SKEYS) - 1 and f > SKEYS[i][0]:
        i += 1
    f0, p0, t0 = SKEYS[i - 1]; f1, p1, t1 = SKEYS[i]
    e = ease(clamp((f - f0) / (f1 - f0)))
    return p0.lerp(p1, e), t0.lerp(t1, e)


ANCH = {}


def proj(name, co, key):
    v = world_to_camera_view(sc, cam, Vector(co))
    if v.z > 0 and -0.05 < v.x < 1.05 and -0.05 < v.y < 1.05:
        ANCH.setdefault(key, {})[name] = [round(v.x, 4), round(1 - v.y, 4)]


def set_beam(yaw, power):
    d = Vector((math.cos(yaw), math.sin(yaw), -0.035))
    spots[0].rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    spots[1].rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    spots[0].data.energy = 4.0e6 * power; spots[1].data.energy = 2.5e6 * power
    glowl.data.energy = 3000 * power
    core.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 60 * power


def state(kind, f):
    under = False
    if kind == "intro":
        # 0-14 dark, a point of light; 10-42 the tower rises segment by segment; 40-59 the lamp and the beam come in
        cp, ct = HERO_P, HERO_T
        build = [seg(f, 10 + k * 3.2, 18 + k * 3.2) for k in range(NSEG)]
        topk = seg(f, 34, 42)
        lightk = seg(f, 40, 52)
        pin = 0.04 + 0.5 * seg(f, 2, 10) * (1 - lightk)
        set_beam(math.radians(268 - 60 * seg(f, 40, 59)), max(lightk, 0.0) + 0.0)
        core.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 60 * max(lightk, pin)
        seamk = [seg(f, 16 + k * 3.2, 22 + k * 3.2) for k in range(NSEG)]
        sscroll = None
    else:
        cp, ct = cam_at(f)
        build = [1.0] * NSEG; topk = 1.0; seamk = [1.0] * NSEG
        set_beam(math.radians(208 - f * 1.4), 1.0 if f < 58 else 0.35)
        under = f >= 55
    cam.location = cp
    cam.rotation_euler = (ct - cp).to_track_quat("-Z", "Y").to_euler()
    cam.data.dof.focus_distance = (ct - cp).length
    # the tower assembling
    for k, (sgo, ring, slit, ps, pr, pl) in enumerate(segments):
        drop = (1 - build[k]) * -(14 + k * 2)
        for o, p0 in ((sgo, ps), (ring, pr), (slit, pl)):
            o.location = p0 + Vector((0, 0, drop))
            o.hide_render = build[k] < 0.01
        ring.data.materials[0] = seam
        ring.hide_render = ring.hide_render or seamk[k] < 0.5
        slit.hide_render = slit.hide_render or seamk[k] < 0.5
    for o in (deck, deckring, lan, capo, mast, tip):
        o.hide_render = topk < 0.01
        o.scale = (max(topk, 1e-3),) * 3
    tip.hide_render = tip.hide_render or (int(f) // 6) % 2 == 1
    redpt.data.energy = 0 if tip.hide_render else 40
    # above / below the surface
    fog.hide_render = mist.hide_render = under
    water.hide_render = not under
    snow.hide_render = plank.hide_render = plank2.hide_render = not under
    for wl_ in wall_lights:
        wl_.data.energy = 6000 if under else 0
    sea.data.materials[0] = under_sea if under else sm
    shaft.data.energy = 3.0e5 if under else 0
    wbg.inputs["Strength"].default_value = 0.0 if under else 0.035
    # the deep: rugs sinking, the school turning, the beacon rings breathing
    for m in mines:
        bob = Vector((0, 0, 0.18 * math.sin(f * 0.08 + m["ph"])))
        for o, p0 in m["parts"]:
            o.location = p0 + bob
            o.hide_render = not under
        on = (int(f + m["ph"] * 10) // 8) % 2 == 0
        m["led"].hide_render = (not under) or not on
        m["light"].data.energy = 80 if (under and on) else 0
    for j in jellies:
        lift = Vector((0, 0, f * j["rise"] + 0.15 * math.sin(f * 0.15 + j["ph"])))
        for o, p0 in j["parts"]:
            o.location = p0 + lift
            o.hide_render = not under
    for d in fish:
        a = d["t"] + f * 0.04 * d["sp"]
        d["o"].location = SCHOOL + Vector((math.cos(a) * d["r"], math.sin(a) * d["r"] * 0.6, d["h"] + 0.4 * math.sin(a * 2)))
        d["o"].rotation_euler = (0, 0, a + math.pi / 2)
        d["o"].hide_render = not under
    # tags
    key = f"{kind[0]}{f}"
    if kind == "scroll":
        if f <= 40:
            proj("tower", L + Vector((1.3, 0, 0)), key)
            proj("rock", T + Vector((-2.8, -1, 0.6)), key)
        if 64 <= f <= 100:
            for k, m in enumerate(mines[:4]):
                proj(f"mine{k}", m["c"] + Vector((0.7, 0, 0.5)), key)
        if f >= 100:
            proj("wreck", wreck.location + Vector((0, 0, 3)), key)
            proj("school", SCHOOL + Vector((0, 0, 1.2)), key)
            proj("beacon", beacon.location + Vector((0, 0, 3.4)), key)


t0 = time.time()
for f in range(first, last + 1, step):
    state(part, f)
    sc.render.filepath = f"{OUT}/{part[0]}{f:03d}.png"
    bpy.ops.render.render(write_still=True)
    print(f"frame {part} {f} done {time.time() - t0:.0f}s", flush=True)
    with open(f"{OUT}/anchors_{part}_{first}_{last}_{step}.json", "w") as fh:
        json.dump(ANCH, fh)
