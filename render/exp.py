# Experimental moon-base concepts.  usage: python exp.py <rail|crater|shards> [samples]
import sys, math, random
sys.path.insert(0, "/root/render")
import bpy, bmesh
from mathutils import Vector, Euler
from lib import reset, mat, camera, panel

concept = sys.argv[1]
samples = int(sys.argv[2]) if len(sys.argv) > 2 else 48
random.seed(3)
sc = reset()
sc.cycles.samples = samples
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.view_settings.look = "AgX - Punchy"
N = "/root/render/nasa"

# dark sky with stars, a faint violet glow low on the horizon
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 260
rp = nt.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.elements[0].position = 0.0; rp.color_ramp.elements[0].color = (1, 1, 1, 1)
rp.color_ramp.elements[1].position = 0.035; rp.color_ramp.elements[1].color = (0, 0, 0, 1)
nt.links.new(vo.outputs["Distance"], rp.inputs["Fac"])
mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1
nt.links.new(rp.outputs["Color"], mul.inputs[6]); nt.links.new(vo.outputs["Color"], mul.inputs[7])
glow = nt.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "ADD"; glow.inputs["Factor"].default_value = 1
tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
hz = nt.nodes.new("ShaderNodeValToRGB"); hz.color_ramp.elements[0].position = 0.0; hz.color_ramp.elements[0].color = (0.10, 0.05, 0.22, 1)
hz.color_ramp.elements[1].position = 0.35; hz.color_ramp.elements[1].color = (0, 0, 0, 1)
nt.links.new(sep.outputs["Z"], hz.inputs["Fac"])
nt.links.new(mul.outputs[2], glow.inputs[6]); nt.links.new(hz.outputs["Color"], glow.inputs[7])
nt.links.new(glow.outputs[2], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.5; nt.links.new(bg.outputs[0], out.inputs["Surface"])


def emit(name, color, s):
    return mat(name, (0, 0, 0), emit=color, emit_s=s)


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# the moon: a big sphere with the NASA colour + height maps, so the horizon curves in frame
RM = 40
bpy.ops.mesh.primitive_uv_sphere_add(radius=RM, segments=256, ring_count=128, location=(0, 0, -RM))
moon = smooth(bpy.context.object); moon.rotation_euler = (math.pi / 2, 0, 0.6)
mm = bpy.data.materials.new("moon"); mm.use_nodes = True; mn = mm.node_tree; mb = mn.nodes["Principled BSDF"]
ci = mn.nodes.new("ShaderNodeTexImage"); ci.image = bpy.data.images.load(f"{N}/lroc_color_2k.jpg")
hi = mn.nodes.new("ShaderNodeTexImage"); hi.image = bpy.data.images.load(f"{N}/ldem_3_8bit.jpg"); hi.image.colorspace_settings.name = "Non-Color"
mp = mn.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (6, 6, 1)
uv = mn.nodes.new("ShaderNodeTexCoord"); mn.links.new(uv.outputs["UV"], mp.inputs["Vector"])
mn.links.new(mp.outputs[0], ci.inputs["Vector"]); mn.links.new(mp.outputs[0], hi.inputs["Vector"])
tint = mn.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs["Factor"].default_value = 1
tint.inputs[7].default_value = (0.82, 0.78, 0.95, 1)
mn.links.new(ci.outputs[0], tint.inputs[6]); mn.links.new(tint.outputs[2], mb.inputs["Base Color"])
bump = mn.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.8; bump.inputs["Distance"].default_value = 0.6
mn.links.new(hi.outputs[0], bump.inputs["Height"]); mn.links.new(bump.outputs[0], mb.inputs["Normal"])
mb.inputs["Roughness"].default_value = 0.95
moon.data.materials.append(mm)

dark = mat("dark", (0.03, 0.03, 0.045), metal=0.85, rough=0.32)
steel = mat("steel", (0.25, 0.25, 0.3), metal=0.9, rough=0.3)
violet = emit("violet", (0.55, 0.35, 1.0), 12)
cyan = emit("cyan", (0.35, 0.95, 1.0), 10)
green = emit("green", (0.3, 1.0, 0.55), 12)
red = emit("red", (1.0, 0.12, 0.1), 16)
white = mat("hull", (0.9, 0.89, 0.95), metal=0.1, rough=0.32)
rred = mat("nose", (0.75, 0.06, 0.07), metal=0.2, rough=0.35)


def rocket(loc, direction, s=1.0, flame=True):
    """the yeppo Blender rocket (5 units tall, base at 0) pointing along direction"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath="/home/user/nextclick-saas/yeppo-oracle/public/moon/yp_rocket.glb")
    new = [o for o in bpy.data.objects if o not in before]
    g = bpy.data.objects.new("rocket", None); bpy.context.collection.objects.link(g)
    for o in new:
        if o.parent is None:
            o.parent = g
    if flame:
        bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.05, depth=3.2, location=(0, 0, -1.6), rotation=(math.pi, 0, 0))
        f = smooth(bpy.context.object); f.data.materials.append(emit("flame", (1.0, 0.55, 0.22), 18)); f.parent = g
        bpy.ops.object.light_add(type="POINT", location=(0, 0, -1.0)); l = bpy.context.object; l.data.energy = 900 * s * s; l.data.color = (1, 0.6, 0.3); l.parent = g
    g.location = loc; g.scale = (s, s, s)
    g.rotation_euler = Vector(direction).to_track_quat("Z", "Y").to_euler()
    return g


def tube(name, pts, r, m, closed=False):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 4
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    o.data.materials.append(m)
    return o


def ring(loc, r, minor, m, normal):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=96, minor_segments=12, location=loc)
    o = bpy.context.object
    o.rotation_euler = Vector(normal).to_track_quat("Z", "Y").to_euler()
    o.data.materials.append(m)
    return smooth(o)


if concept == "rail":
    # the gauntlet: a curved mass-driver rail rising off the surface, 24 rings along it, the rocket flying through
    def arc(t):  # from the ground at x=-14 up and away into the sky
        x = -14 + t * 30
        z = 0.4 + (t ** 2.2) * 16
        return Vector((x, 2 * math.sin(t * 1.4), z))
    pts = [arc(i / 200) for i in range(201)]
    tube("rail_a", [p + Vector((0, 0.35, 0)) for p in pts], 0.08, steel)
    tube("rail_b", [p + Vector((0, -0.35, 0)) for p in pts], 0.08, steel)
    tube("rail_glow", [p + Vector((0, 0, -0.2)) for p in pts], 0.03, violet)
    # supports down to the ground
    for i in range(10, 200, 14):
        p = pts[i]
        if p.z > 0.8:
            tube(f"sup{i}", [p + Vector((0, 0, -0.25)), Vector((p.x, p.y, -0.2))], 0.07, dark)
    # 24 rings: the first ones green (passed), one red (where a rug gets caught), the rest violet ahead
    for k in range(24):
        t = 0.04 + k * 0.038
        p = arc(t); d = (arc(t + 0.01) - p).normalized()
        m = green if k < 15 else (red if k == 15 else violet)
        ring(p, 1.15, 0.05, m, d)
    rp_t = 0.62
    d_ = (arc(rp_t + 0.01) - arc(rp_t)).normalized(); rocket(arc(rp_t) - d_ * 1.3, d_, 0.5)
    # a station at the foot of the rail, built into the ground
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-15.5, 0, 0.3)); st = bpy.context.object; st.scale = (3, 2.4, 1.0); st.data.materials.append(dark)
    b = st.modifiers.new("b", "BEVEL"); b.width = 0.15; b.segments = 4
    tube("st_glow", [(-17, -1.2, 0.81), (-14, -1.2, 0.81), (-14, 1.2, 0.81), (-17, 1.2, 0.81)], 0.03, cyan, closed=True)
    panel("key", (-6, -18, 10), (10, 4), 2.5, target=(0, 0, 4), color=(0.75, 0.7, 1))
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(78), 0, math.radians(-40))); s = bpy.context.object; s.data.energy = 2.2; s.data.color = (1, 0.95, 0.9)
    camera((-19, -11, 2.2), (1, 1, 5.0), lens=24)

elif concept == "crater":
    # a base dug into a crater: terraces stepping down, light lines on each lip, a spiral rail lifting the rocket out
    steps = [(12.5, 0.6), (11, 0.0), (9.2, -1.2), (7.4, -2.4), (5.6, -3.6), (3.6, -4.8)]
    prof = [(14.5, -0.6), (13.2, 0.9), (12.5, 0.6)]
    for (r0, z0), (r1, z1) in zip(steps, steps[1:]):
        prof += [(r0, z1), (r1, z1)] if False else [(r0 - 0.15, z1 + 0.05), (r1, z1)]
    prof += [(0.0, steps[-1][1])]
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in prof]
    for i in range(len(vs) - 1):
        bm.edges.new((vs[i], vs[i + 1]))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=160, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    me = bpy.data.meshes.new("crater"); bm.to_mesh(me); cr = bpy.data.objects.new("crater", me); bpy.context.collection.objects.link(cr)
    cr.data.materials.append(dark); bv = cr.modifiers.new("b", "BEVEL"); bv.width = 0.08; bv.segments = 2; bv.limit_method = "ANGLE"
    # cut the hole in the moon
    bpy.ops.mesh.primitive_cylinder_add(radius=13.6, depth=12, vertices=128, location=(0, 0, -4))
    cut = bpy.context.object; bo = moon.modifiers.new("cut", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"; bo.solver = "FAST"; cut.hide_render = True
    for k, (r, z) in enumerate(steps[1:]):
        ring((0, 0, z + 0.06), r - 0.12, 0.05, cyan if k % 2 else violet, (0, 0, 1))
        n = 12 + k * 3
        for j in range(n):  # little habitats along each terrace, with lit windows
            a_ = j / n * 2 * math.pi + k
            rr = r + 0.75 if k else r + 0.9
            bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a_) * rr, math.sin(a_) * rr, z + 0.3))
            m_ = bpy.context.object; m_.scale = (0.5, 0.9, 0.55); m_.rotation_euler = (0, 0, a_); m_.data.materials.append(steel)
            bv = m_.modifiers.new("b", "BEVEL"); bv.width = 0.08; bv.segments = 2
            if j % 2 == 0:
                bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a_) * (rr - 0.26), math.sin(a_) * (rr - 0.26), z + 0.38))
                w_ = bpy.context.object; w_.scale = (0.02, 0.55, 0.1); w_.rotation_euler = (0, 0, a_); w_.data.materials.append(emit("win", (1, 0.75, 0.45), 10))
    # the spiral rail out of the crater floor
    pts = []
    for i in range(300):
        t = i / 299
        a_ = t * 4.0 * math.pi
        rr = 2.4 + t * 0.8
        pts.append((math.cos(a_) * rr, math.sin(a_) * rr, -4.7 + t * 13))
    tube("spiral", pts, 0.08, steel)
    tube("spiral_glow", [(x * 0.9, y * 0.9, z) for x, y, z in pts], 0.035, violet)
    for k in range(7):
        ring((0, 0, -4 + k * 1.7), 1.25, 0.045, green if k < 6 else red, (0, 0, 1))
    rocket((0, 0, 7.6), (0, 0, 1), 0.55)
    bpy.ops.object.light_add(type="POINT", location=(0, 0, -3.5)); pl = bpy.context.object; pl.data.energy = 4000; pl.data.color = (0.6, 0.5, 1); pl.data.shadow_soft_size = 3
    panel("key", (-14, -16, 14), (10, 4), 1.6, target=(0, 0, 0), color=(0.75, 0.7, 1))
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(62), 0, math.radians(30))); s_ = bpy.context.object; s_.data.energy = 2.0
    camera((-15, -19, 9.5), (0, 0, 0.5), lens=26)

elif concept == "shards":
    # floating dark shards with neon seams, tethered to the ground by beams; each one is a place
    for k in range(7):
        a = k / 7 * 2 * math.pi
        rr = 6 + (k % 3) * 2.5
        c = Vector((math.cos(a) * rr, math.sin(a) * rr, 3 + (k % 4) * 1.6))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.3 + (k % 3) * 0.5, location=c)
        sh = bpy.context.object
        sh.scale = (0.7, 0.7, 1.8 + (k % 2)); sh.rotation_euler = (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.random() * 3)
        sh.data.materials.append(dark)
        wf = sh.copy(); wf.data = sh.data.copy(); bpy.context.collection.objects.link(wf)
        wf.modifiers.new("w", "WIREFRAME").thickness = 0.035
        wf.data.materials.clear(); wf.data.materials.append(violet if k % 3 else cyan)
        wf.scale = sh.scale * 1.01
        tube(f"beam{k}", [tuple(c), (c.x, c.y, 0)], 0.02, cyan if k % 2 else violet)
        ring((c.x, c.y, 0.05), 0.9, 0.04, cyan if k % 2 else violet, (0, 0, 1))
    # the central launch shard, taller, the rocket leaving from its tip
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.6, location=(0, 0, 4))
    core = bpy.context.object; core.scale = (0.8, 0.8, 3.0); core.data.materials.append(dark)
    wf = core.copy(); wf.data = core.data.copy(); bpy.context.collection.objects.link(wf)
    wf.modifiers.new("w", "WIREFRAME").thickness = 0.04; wf.data.materials.clear(); wf.data.materials.append(green); wf.scale = core.scale * 1.01
    rocket((0, 0, 9.4), (0, 0, 1), 0.55)
    panel("key", (-12, -16, 12), (10, 4), 2.2, target=(0, 0, 3), color=(0.75, 0.7, 1))
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(72), 0, math.radians(-30))); s = bpy.context.object; s.data.energy = 1.8
    camera((-17, -21, 4.5), (0, 0, 5.5), lens=26)

sc.render.filepath = f"/root/render/out/exp_{concept}.png"
bpy.ops.render.render(write_still=True)
print("done", concept)
