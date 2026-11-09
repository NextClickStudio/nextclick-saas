# Shared scene pieces for the yeppo home film: studio, materials, the coin.
import bpy, bmesh, math, os
from mathutils import Vector

STUDIO = "/root/bvenv/lib/python3.11/site-packages/bpy/4.2/datafiles/studiolights/world/studio.exr"


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.glossy_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    sc.render.image_settings.file_format = "PNG"
    return sc


def world(strength=0.35):
    """camera sees black; reflections see the studio HDRI"""
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(STUDIO)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    black = nt.nodes.new("ShaderNodeBackground")
    black.inputs["Color"].default_value = (0, 0, 0, 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(black.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


def mat(name, color=(0.8, 0.8, 0.8), metal=0.0, rough=0.3, trans=0.0, ior=1.45, emit=None, emit_s=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_s
    return m


def softbox(name, loc, rot, size, power, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc, rotation=rot)
    l = bpy.context.object
    l.name = name
    l.data.shape = "RECTANGLE"
    l.data.size, l.data.size_y = size
    l.data.energy = power
    l.data.color = color
    l.visible_glossy = True
    return l


def lathe(name, profile, segs=128):
    """profile: list of (r, z) points, revolved around Z; points with r == 0 become single poles (closed, manifold)"""
    bm = bmesh.new()
    inner = [(r, z) for r, z in profile if r > 1e-6]
    poleA = bm.verts.new((0, 0, profile[0][1])) if profile[0][0] <= 1e-6 else None
    poleB = bm.verts.new((0, 0, profile[-1][1])) if profile[-1][0] <= 1e-6 else None
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * ca, r * sa, z)) for r, z in inner])
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % segs]
        for j in range(len(inner) - 1):
            bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
        if poleA:
            bm.faces.new((poleA, r1[0], r0[0]))
        if poleB:
            bm.faces.new((poleB, r0[-1], r1[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


COIN_PROFILE = [
    (0.0, 0.062), (0.74, 0.062), (0.765, 0.07), (0.79, 0.098), (0.9, 0.1), (0.94, 0.088), (0.975, 0.062), (0.995, 0.03), (1.0, 0.0),
    (0.995, -0.03), (0.975, -0.062), (0.94, -0.088), (0.9, -0.1), (0.79, -0.098), (0.765, -0.07), (0.74, -0.062), (0.0, -0.062),
]


def stroke_mesh(name, pts, w, depth):
    """an extruded bar between two points (x, y), in the XY plane, on z from 0 to depth"""
    (x1, y1), (x2, y2) = pts
    dx, dy = x2 - x1, y2 - y1
    l = math.hypot(dx, dy)
    nx, ny = -dy / l * w / 2, dx / l * w / 2
    quad = [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]
    bm = bmesh.new()
    bot = [bm.verts.new((x, y, 0)) for x, y in quad]
    top = [bm.verts.new((x, y, depth)) for x, y in quad]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def coin(name, chrome, ink, loc=(0, 0, 0)):
    """the yeppo coin, after the logo: a lathed chrome disc with a raised lip, the y cut into the face and filled
    with black lacquer (both faces). Lathe axis is local Z; the object is turned so the face looks at -Y."""
    body = lathe(name, COIN_PROFILE)
    body.data.materials.append(chrome)
    body.data.materials.append(ink)
    w = 11 / 48
    bm = bmesh.new()
    for face in (1, -1):
        for (x1, y1), (x2, y2) in (((30, 27), (50, 58)), ((70, 27), (42, 82))):
            p1 = Vector(((x1 - 50) / 48, (50 - y1) / 48))
            p2 = Vector(((x2 - 50) / 48, (50 - y2) / 48))
            d = (p2 - p1).normalized() * (w / 2)  # square caps
            p1, p2 = p1 - d, p2 + d
            n = Vector((-(p2 - p1).y, (p2 - p1).x)).normalized() * (w / 2)
            quad = [p1 + n, p2 + n, p2 - n, p1 - n]
            rot = math.radians(-8)
            quad = [Vector((q.x * math.cos(rot) - q.y * math.sin(rot), q.x * math.sin(rot) + q.y * math.cos(rot))) for q in quad]
            if face < 0:
                quad = [Vector((-q.x, q.y)) for q in quad][::-1]
            z0, z1 = (0.034, 0.12) if face > 0 else (-0.12, -0.034)
            bot = [bm.verts.new((q.x, q.y, z0)) for q in quad]
            top = [bm.verts.new((q.x, q.y, z1)) for q in quad]
            bm.faces.new(bot[::-1])
            bm.faces.new(top)
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cme = bpy.data.meshes.new(name + "_cut")
    bm.to_mesh(cme)
    bm.free()
    cutter = bpy.data.objects.new(name + "_cut", cme)
    bpy.context.collection.objects.link(cutter)
    bo = body.modifiers.new("y", "BOOLEAN")
    bo.operation = "DIFFERENCE"
    bo.object = cutter
    bo.solver = "EXACT"
    bo.use_self = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    old = body.data
    body.modifiers.clear()
    body.data = me
    bpy.data.meshes.remove(old)
    bpy.data.objects.remove(cutter)
    bpy.data.meshes.remove(cme)
    if len(me.materials) < 2:
        me.materials.clear()
        me.materials.append(chrome)
        me.materials.append(ink)
    # the cut faces take the ink
    for p in body.data.polygons:
        z = sum(body.data.vertices[v].co.z for v in p.vertices) / len(p.vertices)
        r = max(math.hypot(body.data.vertices[v].co.x, body.data.vertices[v].co.y) for v in p.vertices)
        if abs(z) < 0.061 and r < 0.74:
            p.material_index = 1
    bv = body.modifiers.new("bevel", "BEVEL")
    bv.width = 0.006
    bv.segments = 3
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(50)
    body.location = loc
    body.rotation_euler = (math.pi / 2, 0, 0)
    return body


def panel(name, loc, size, strength, target=(0, 0, 0), color=(1, 1, 1)):
    """a softbox: an emissive plane aimed at the target, seen in reflections, not by the camera"""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    p = bpy.context.object
    p.name = name
    p.scale = (size[0], size[1], 1)
    m = mat(name, (0, 0, 0), emit=color, emit_s=strength)
    p.data.materials.append(m)
    p.visible_camera = False
    p.visible_shadow = False
    t = p.constraints.new("TRACK_TO")
    e = bpy.data.objects.new(name + "_t", None)
    bpy.context.collection.objects.link(e)
    e.location = target
    t.target = e
    t.track_axis = "TRACK_NEGATIVE_Z"
    t.up_axis = "UP_Y"
    return p


def camera(loc, look, lens=50, dof=None, fstop=2.8):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.object
    bpy.context.scene.camera = c
    c.data.lens = lens
    d = Vector(look) - Vector(loc)
    c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if dof is not None:
        c.data.dof.use_dof = True
        c.data.dof.focus_distance = dof
        c.data.dof.aperture_fstop = fstop
    return c


def world_gradient(strength=1.0, stops=((0.0, 0.01), (0.45, 0.06), (0.55, 0.5), (0.68, 1.0), (1.0, 0.25))):
    """camera sees black; reflections see a soft studio gradient (dark floor, bright band above the horizon)"""
    w = bpy.data.worlds.new("wg")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1
    mr.inputs["From Max"].default_value = 1
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (stops[0][1],) * 3 + (1,)
    els[1].position, els[1].color = stops[-1][0], (stops[-1][1],) * 3 + (1,)
    for pos, v in stops[1:-1]:
        e = els.new(pos)
        e.color = (v, v, v * 1.02, 1)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    black = nt.nodes.new("ShaderNodeBackground")
    black.inputs["Color"].default_value = (0, 0, 0, 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(black.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


def chrome_coin_mat(name="coinchrome", rough=0.16, aniso=0.55, reeds=170):
    """polished metal brushed in circles around the coin's axis, with a reeded edge"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.93, 0.93, 0.94, 1)
    b.inputs["Metallic"].default_value = 1
    b.inputs["Roughness"].default_value = rough
    b.inputs["Anisotropic"].default_value = aniso
    tg = nt.nodes.new("ShaderNodeTangent")
    tg.direction_type = "RADIAL"
    tg.axis = "Z"
    nt.links.new(tg.outputs[0], b.inputs["Tangent"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    at = nt.nodes.new("ShaderNodeMath"); at.operation = "ARCTAN2"
    nt.links.new(sep.outputs["Y"], at.inputs[0]); nt.links.new(sep.outputs["X"], at.inputs[1])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = reeds
    nt.links.new(at.outputs[0], mul.inputs[0])
    sn = nt.nodes.new("ShaderNodeMath"); sn.operation = "SINE"
    nt.links.new(mul.outputs[0], sn.inputs[0])
    # radius mask: only the outer wall
    x2 = nt.nodes.new("ShaderNodeMath"); x2.operation = "MULTIPLY"
    nt.links.new(sep.outputs["X"], x2.inputs[0]); nt.links.new(sep.outputs["X"], x2.inputs[1])
    y2 = nt.nodes.new("ShaderNodeMath"); y2.operation = "MULTIPLY"
    nt.links.new(sep.outputs["Y"], y2.inputs[0]); nt.links.new(sep.outputs["Y"], y2.inputs[1])
    r2 = nt.nodes.new("ShaderNodeMath"); r2.operation = "ADD"
    nt.links.new(x2.outputs[0], r2.inputs[0]); nt.links.new(y2.outputs[0], r2.inputs[1])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.955
    mr.inputs["From Max"].default_value = 0.985
    nt.links.new(r2.outputs[0], mr.inputs["Value"])
    h = nt.nodes.new("ShaderNodeMath"); h.operation = "MULTIPLY"
    nt.links.new(sn.outputs[0], h.inputs[0]); nt.links.new(mr.outputs["Result"], h.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(h.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def y_polygon():
    """the logo's y as one outline in coin units (radius 1), rotated like the logo, kept inside the face"""
    from shapely.geometry import LineString, Point
    from shapely.ops import unary_union
    from shapely import affinity
    w = 11 / 48
    P = lambda x, y: ((x - 50) / 48, (50 - y) / 48)
    a = LineString([P(30, 27), P(50, 58)]).buffer(w / 2, cap_style="square", join_style="mitre")
    b = LineString([P(70, 27), P(42, 82)]).buffer(w / 2, cap_style="square", join_style="mitre")
    y = unary_union([a, b])
    y = affinity.rotate(y, -8, origin=(0, 0))
    y = y.intersection(Point(0, 0).buffer(0.71, 128)).simplify(0.002)
    return list(y.exterior.coords)[:-1]


def prism(name, poly, z0, z1):
    bm = bmesh.new()
    bot = [bm.verts.new((x, yv, z0)) for x, yv in poly]
    top = [bm.verts.new((x, yv, z1)) for x, yv in poly]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def coin2(name, chrome, enamel, loc=(0, 0, 0)):
    """the coin: lathed body, the y engraved on both faces and filled with enamel; face looks at -Y"""
    body = lathe(name, COIN_PROFILE)
    body.data.materials.append(chrome)
    poly = y_polygon()
    mirror = [(-x, yv) for x, yv in poly][::-1]
    top_face, depth = 0.062, 0.026
    cutA = prism(name + "_ca", poly, top_face - depth, top_face + 0.05)
    cutB = prism(name + "_cb", mirror, -top_face - 0.05, -top_face + depth)
    for c in (cutA, cutB):
        bo = body.modifiers.new("cut", "BOOLEAN")
        bo.operation = "DIFFERENCE"
        bo.object = c
        bo.solver = "EXACT"
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg))
    old = body.data
    body.modifiers.clear()
    body.data = me
    bpy.data.meshes.remove(old)
    for c in (cutA, cutB):
        m = c.data
        bpy.data.objects.remove(c)
        bpy.data.meshes.remove(m)
    me.materials.clear()
    me.materials.append(chrome)
    for p in me.polygons:
        p.use_smooth = False
    bv = body.modifiers.new("bevel", "BEVEL")
    bv.width = 0.004
    bv.segments = 2
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(40)
    body.modifiers.new("wn", "WEIGHTED_NORMAL")
    # the enamel fill, a hair below the face
    for nm, pg, z0, z1 in ((name + "_ea", poly, top_face - depth + 0.001, top_face - 0.004), (name + "_eb", mirror, -top_face + 0.004, -top_face + depth - 0.001)):
        e = prism(nm, pg, z0, z1)
        e.data.materials.append(enamel)
        ebv = e.modifiers.new("bevel", "BEVEL")
        ebv.width = 0.002
        ebv.segments = 2
        e.parent = body
    body.location = loc
    body.rotation_euler = (math.pi / 2, 0, 0)
    return body


def reflect_panel(name, obj, cam, dist=10, size=(6, 3), strength=3, shift=(0, 0, 0), color=(1, 1, 1)):
    """a softbox placed where the camera sees it mirrored in the object's face (local +Z of the lathe)"""
    bpy.context.view_layer.update()
    n = (obj.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    p = obj.matrix_world.translation
    d = (p - cam.location).normalized()
    if d.dot(n) > 0:
        n = -n
    r = d - 2 * d.dot(n) * n
    return panel(name, tuple(p + r * dist + Vector(shift)), size, strength, target=tuple(p), color=color)
