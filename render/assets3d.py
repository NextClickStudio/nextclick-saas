# Hero objects for the moon home, modelled in Blender and exported as GLB: the rocket and the launch tower.
# usage: bvenv/bin/python assets3d.py   -> /home/user/nextclick-saas/yeppo-oracle/public/moon/yp_rocket.glb, yp_tower.glb (+ preview PNGs)
import sys, math, os
sys.path.insert(0, "/root/render")
import bpy, bmesh
from mathutils import Vector
from lib import reset, world_gradient, camera, panel

A = "/root/render/assets"
OUT = "/home/user/nextclick-saas/yeppo-oracle/public/moon"
bpy.ops.preferences.addon_enable(module="io_scene_gltf2")


def pbr(name, folder, tint=(1, 1, 1), metal=None, rough_mul=1.0, uv_scale=1.0, normal_strength=1.0):
    """a PBR material from a Poly Haven texture set, tinted (glTF-exportable: base colour x tint via multiply is baked as factor)"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeUVMap")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (uv_scale, uv_scale, 1)
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])

    def tex(f, color=True):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(f"{A}/{folder}/{f}.jpg")
        if not color:
            t.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], t.inputs["Vector"])
        return t

    d = tex("Diffuse")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*tint, 1)
    nt.links.new(d.outputs[0], mix.inputs[6])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    nt.links.new(tex("Rough", False).outputs[0], b.inputs["Roughness"])
    if metal is None and os.path.exists(f"{A}/{folder}/Metal.jpg"):
        nt.links.new(tex("Metal", False).outputs[0], b.inputs["Metallic"])
    else:
        b.inputs["Metallic"].default_value = metal or 0.0
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = normal_strength
    nt.links.new(tex("nor_gl", False).outputs[0], nm.inputs["Color"])
    nt.links.new(nm.outputs[0], b.inputs["Normal"])
    return m


def flat(name, color, metal=0.0, rough=0.4, emit=None, emit_s=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_s
    return m


def lathe_uv(name, prof, segs=64, mat=None):
    """revolve (r, z) points round Z, with cylindrical UVs; r == 0 ends become poles"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    zs = [z for _, z in prof]
    z0, z1 = min(zs), max(zs)
    rings = []
    for i in range(segs + 1):
        a = 2 * math.pi * i / segs
        rings.append([bm.verts.new((max(r, 1e-4) * math.cos(a), max(r, 1e-4) * math.sin(a), z)) for r, z in prof])
    for i in range(segs):
        for j in range(len(prof) - 1):
            f = bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ii / segs * 2.0, (prof[jj][1] - z0) / (z1 - z0) * 2.5)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    if mat:
        me.materials.append(mat)
    return ob


def bevel(o, w=0.02, seg=3):
    b = o.modifiers.new("b", "BEVEL")
    b.width = w
    b.segments = seg
    b.limit_method = "ANGLE"
    o.modifiers.new("wn", "WEIGHTED_NORMAL")
    return o


def box(name, size, loc, mat, rot=(0, 0, 0), w=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.uv.cube_project(cube_size=1.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    o.data.materials.append(mat)
    return bevel(o, w)


def export(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_image_format="JPEG",
                              export_jpeg_quality=80, export_apply=True, export_yup=True)
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


# ======================================== the rocket ========================================
sc = reset()
white = flat("hull", (0.9, 0.89, 0.95), metal=0.1, rough=0.32)
red = flat("nose_red", (0.75, 0.06, 0.07), metal=0.2, rough=0.35)
purple = flat("band", (0.32, 0.18, 0.95), metal=0.4, rough=0.35)
steel = pbr("engine", "metal_plate_02", tint=(0.55, 0.55, 0.62), uv_scale=1.0)
glass = flat("window", (0.02, 0.15, 0.2), metal=0.0, rough=0.05, emit=(0.3, 0.85, 1.0), emit_s=1.6)
H = 5.0
body = lathe_uv("rocket_body", [
    (0.0, 0.42), (0.5, 0.42), (0.56, 0.5), (0.6, 0.7), (0.6, 3.2), (0.58, 3.5), (0.52, 3.85), (0.0, 3.86)], mat=white)
nose = lathe_uv("rocket_nose", [
    (0.52, 3.84), (0.5, 4.05), (0.44, 4.35), (0.34, 4.62), (0.2, 4.85), (0.07, 4.97), (0.0, 5.0)], mat=red)
for z, hgt in ((1.1, 0.16), (3.1, 0.1)):
    lathe_uv(f"band_{z}", [(0.0, z), (0.615, z), (0.615, z + hgt), (0.0, z + hgt)], mat=purple)
nozzle = lathe_uv("rocket_nozzle", [(0.0, 0.42), (0.28, 0.42), (0.26, 0.3), (0.34, 0.12), (0.44, 0.0), (0.4, -0.02), (0.3, 0.1), (0.2, 0.28), (0.0, 0.3)], mat=steel)
# window: a frame and lit glass
bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.035, location=(0, -0.6, 2.55), rotation=(math.pi / 2, 0, 0))
frame_ = bpy.context.object
frame_.data.materials.append(steel)
bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.04, location=(0, -0.59, 2.55), rotation=(math.pi / 2, 0, 0), vertices=32)
win = bpy.context.object
win.data.materials.append(glass)
# fins: a swept profile, extruded and bevelled
fins = []
for k in range(3):
    bm = bmesh.new()
    pts = [(0.55, 0.45), (1.25, 0.05), (1.3, 0.35), (0.6, 1.6)]
    bot = [bm.verts.new((x, -0.04, z)) for x, z in pts]
    top = [bm.verts.new((x, 0.04, z)) for x, z in pts]
    bm.faces.new(bot)
    bm.faces.new(top[::-1])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"fin{k}")
    bm.to_mesh(me)
    bm.free()
    f = bpy.data.objects.new(f"fin{k}", me)
    bpy.context.collection.objects.link(f)
    f.rotation_euler = (0, 0, k * 2 * math.pi / 3 + math.pi / 2)
    me.materials.append(red)
    bevel(f, 0.025, 3)
    fins.append(f)
# small details: a ladder of vents and a panel strip
for k in range(4):
    box(f"vent{k}", (0.09, 0.04, 0.22), (0.42 * math.cos(2.4), 0.42 * math.sin(2.4) - 0.0, 1.5 + k * 0.32), steel, rot=(0, 0, 2.4), w=0.01).location = (0.6 * math.cos(2.4), 0.6 * math.sin(2.4), 1.5 + k * 0.32)
rocket = [body, nose, nozzle, frame_, win] + fins + [o for o in bpy.data.objects if o.name.startswith(("band_", "vent"))]
# preview
world_gradient(1.0)
panel("key", (-4, -6, 6), (4, 3), 6, target=(0, 0, 2.5))
panel("rim", (5, 3, 3), (0.6, 6), 9, target=(0, 0, 2.5), color=(0.8, 0.85, 1))
camera((3.2, -7.5, 3.2), (0, 0, 2.4), lens=50)
sc.render.resolution_x, sc.render.resolution_y = 640, 800
sc.cycles.samples = 48
sc.render.filepath = "/root/render/out/yp_rocket.png"
bpy.ops.render.render(write_still=True)
export(f"{OUT}/yp_rocket.glb", rocket)

# ======================================== the launch tower ========================================
sc = reset()
dark = pbr("tower_steel", "metal_plate_02", tint=(0.42, 0.42, 0.5), uv_scale=1.5)
orange = flat("tower_orange", (0.9, 0.35, 0.08), metal=0.3, rough=0.45)
red_l = flat("tower_light", (0.2, 0.0, 0.0), emit=(1.0, 0.1, 0.08), emit_s=8.0)
parts = []
TH, W = 6.2, 0.8
for x in (-W / 2, W / 2):
    for y in (-W / 2, W / 2):
        parts.append(box("leg", (0.1, 0.1, TH), (x, y, TH / 2), dark))
levels = 9
for k in range(levels + 1):
    z = 0.3 + k * (TH - 0.4) / levels
    for (sx, sy, rx) in (((W, 0.07, 0.07), (0, -W / 2, z), 0), ((W, 0.07, 0.07), (0, W / 2, z), 0)):
        parts.append(box("rung", sx, sy, dark, w=0.008))
    parts.append(box("rung", (0.07, W, 0.07), (-W / 2, 0, z), dark, w=0.008))
    parts.append(box("rung", (0.07, W, 0.07), (W / 2, 0, z), dark, w=0.008))
    if k < levels:
        dz = (TH - 0.4) / levels
        ang = math.atan2(dz, W)
        for y in (-W / 2, W / 2):
            parts.append(box("diag", (math.hypot(W, dz), 0.05, 0.05), (0, y, z + dz / 2), dark, rot=(0, -ang if k % 2 else ang, 0), w=0.006))
# the swing arm toward the rocket and a work platform
parts.append(box("arm", (1.6, 0.22, 0.18), (1.2, 0, 4.4), orange))
parts.append(box("arm2", (1.2, 0.18, 0.14), (1.0, 0, 2.6), orange))
parts.append(box("deck", (W + 0.5, W + 0.5, 0.08), (0, 0, TH + 0.04), dark))
parts.append(box("base", (W + 0.8, W + 0.8, 0.25), (0, 0, 0.12), dark))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, TH + 0.3))
beacon = bpy.context.object
beacon.data.materials.append(red_l)
parts.append(beacon)
world_gradient(1.0)
panel("key", (-4, -6, 6), (4, 3), 6, target=(0, 0, 3))
camera((5, -8, 4), (0.4, 0, 3), lens=45)
sc.render.resolution_x, sc.render.resolution_y = 640, 800
sc.cycles.samples = 48
sc.render.filepath = "/root/render/out/yp_tower.png"
bpy.ops.render.render(write_still=True)
export(f"{OUT}/yp_tower.glb", parts)
