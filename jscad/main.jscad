
include("platonic.jscad");

fn = 5;

function showSolid(points, faces) {
  return polyhedron({points: points, triangles: faces});
}

// Expects a dimension object in the followiong form
// {b: width, h: height, t1: t1, t2: t2}
// Visual: https://www.aichi-steel.co.jp/ENGLISH/products/stainless/img/stainless_06_pic05.png
function createTBarProfile(spec) {
  return CAG.fromPoints([
    [0, 0], [spec.b/2, 0],
    [spec.b/2, spec.t2],
    [spec.t1/2, spec.t2],
    [spec.t1/2, spec.h],
    [-spec.t1/2, spec.h],
    [-spec.t1/2, spec.t2],
    [-spec.b/2, spec.t2],
    [-spec.b/2, 0]
  ]);
}

function createStrut(startPoint, endPoint, profile) {
  // Create transform that results in z axis pointing to endPoint - startPoint
  // See http://forum.openscad.org/Rods-between-3D-points-td13104.html

  var startPointVector = new CSG.Vector3D(startPoint);
  var endPointVector = new CSG.Vector3D(endPoint);

  // New z axis
  var wDirection = endPointVector.minus(startPointVector);
  // normalize
  var distance = wDirection.length();
  var w = wDirection.dividedBy(distance);

  // The new x axis should point perpendicular to the triangle formed by [0,0,0],
  // startPoint and endPoint,
  var uDirection = endPointVector.cross(startPointVector);
  var u = uDirection.dividedBy(uDirection.length());

  // The new y direction needs to be perpendicular to the new w (x) and u (z)
  // vectors.
  var vDirection = wDirection.cross(uDirection);
  var v = vDirection.dividedBy(vDirection.length());

  var matrix = new CSG.Matrix4x4([
    u.x, u.y, u.z, 0,
    v.x, v.y, v.z, 0,
    w.x, w.y, w.z, 0,
    startPointVector.x, startPointVector.y, startPointVector.z, 1
  ]);

  //var rectangle = square([width , height]);
  var strut = linear_extrude({ height: distance }, profile.scale([distance, distance]));

  var objects = [];
  objects.push(strut.transform(matrix));

  return union(objects);
}

function showStruts(points, faces, strutProfile) {
  // There should be only one strut per edge
  var edgeKeysSet = new Set();
  var faceCount = faces.length;
  let edgeKeyFn = createEdgeKeyFunction(faceCount);

  var objects = [];

  for(var i = 0; i < faces.length; i++) {
    var face = faces[i];
    for(var j = 0; j < 3; j++) {
      var startPointIndex = face[j];
      var endPointIndex = face[(j + 1) % 3];

      // Find the associated edge
      var edgeKey = edgeKeyFn(startPointIndex, endPointIndex);
      // Has this edge already been handled?
      if (edgeKeysSet.has(edgeKey)) {
        //console.log("Skipping edge " + edgeKey);
        continue;
      }

      //console.log("Creating edge " + edgeKey);
      edgeKeysSet.add(edgeKey);

      var startPoint = points[startPointIndex];
      var endPoint = points[endPointIndex];

      objects.push(createStrut(startPoint, endPoint, strutProfile));
      //objects.push(cylinder({start: startPoint, end: endPoint, fn:fn, r: 0.05}));
    }
  }
  return objects;
}

function showFaces(points, faces) {
  var objects = [];
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    var alpha = 1;
    for(let j = 0; j < face.length; j++) {
      var startPoint = points[face[j]];
      var endPoint = points[face[(j+1) % face.length]];

      objects.push(cylinder({start: startPoint, end: endPoint, fn:fn, r: 0.05}).setColor(1,0,0,alpha));
      alpha = alpha - 0.3;

      //if (j == 1) { j = 1000; }
    }
  }
  return union(objects);
}

function createEdgeKeyFunction(faceCount) {
  return function(pointIndex1, pointIndex2) {
    var edgeKey;
    if (pointIndex1 > pointIndex2) {
      edgeKey = pointIndex1 * 3 * faceCount + pointIndex2;
    } else {
      edgeKey = pointIndex2 * 3 * faceCount + pointIndex1;
    }
    //console.log("Edge key for " + pointIndex1 + " and " + pointIndex2 + " is " + edgeKey);
    return edgeKey;
  };
}

function subdivideFaces(points, faces, newFaces) {
  // We reuse the points array but create new faces.
  var edgesMap = new Map();
  var faceCount = faces.length;
  let edgeKeyFn = createEdgeKeyFunction(faceCount);
  //console.log("subdividing faces; face count = " + faceCount);
  for (var faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    var face = faces[faceIndex];
    subdivideFace(points, face, newFaces, edgesMap, edgeKeyFn);
  }

  console.log("point count: " + points.length);
  console.log("face count: " + newFaces.length);
}

// startPoint and endPoint are an array holding the x,y,z coordinates each.
function createSplitPoint(startPoint, endPoint) {
  let start = new CSG.Vector3D(startPoint);
  let end = new CSG.Vector3D(endPoint);

  let split = start.plus(end).dividedBy(2);
  // normalize so that is lies on the sphere
  split = split.dividedBy(split.length());
  return [split.x, split.y, split.z];
}

// points: Array of points (CSG.Vector3D) that the face indexes into
// face: A face (triangle) of the polyhedron defined as an array of three integers
// that constitute the indexes of corners in the points array (clockwise when
// looked at from the outside of the polygon).
function subdivideFace(points, face, newFaces, edgesMap, edgeKeyFn) {
  var splitPointIndexes = []
  //console.log("  subdividing face " + JSON.stringify(face));
  //console.log("  points.length " + points.length);
  for (var i = 0; i < 3; i++) {
    var startPointIndex = face[i];
    var endPointIndex = face[(i + 1) % 3];
    // Find the associated edge
    var edgeKey = edgeKeyFn(startPointIndex, endPointIndex);
    // Has this edge already been handled?
    let splitPointIndex = edgesMap.get(edgeKey);
    if (splitPointIndex === undefined) {
      //console.log("creating split point between " + startPointIndex + " and " + endPointIndex);
      splitPoint = createSplitPoint(points[startPointIndex], points[endPointIndex]);
      points.push(splitPoint);
      splitPointIndex = points.length - 1;
      edgesMap.set(edgeKey, splitPointIndex);
    }
    splitPointIndexes.push(splitPointIndex);
  }

  //console.log("splitPointIndexes = " + JSON.stringify(splitPointIndexes));
  //console.log("edges map " + edgesMap.size);

  // Create and push new faces
  newFaces.push([face[0], splitPointIndexes[0], splitPointIndexes[2]]);
  newFaces.push([splitPointIndexes[0], face[1], splitPointIndexes[1]]);
  newFaces.push([splitPointIndexes[1], face[2], splitPointIndexes[2]]);
  newFaces.push([splitPointIndexes[2], splitPointIndexes[0], splitPointIndexes[1]]);
}

function main() {
  var objects = [];
  var data = icosahedron();
  var points = data[0];
  var faces = data[1];

  console.log("point count: " + points.length);
  console.log("face count: " + faces.length);

  var subdivisionIterationCount = 1;
  for (var i = 0; i < subdivisionIterationCount; i++) {
    var newFaces = [];
    subdivideFaces(points, faces, newFaces);
    faces = newFaces;
  }

  // Profile dimensions for a strut of length 1; the profile will be scaled
  // based on the actual strut length.
  let tBarSpec = {b: 0.1, h: 0.3, t1: 0.05, t2: 0.01}
  var strutProfile = createTBarProfile(tBarSpec);

  var strutObjects = showStruts(points, faces, strutProfile);

  console.log("edge count: " + strutObjects.length);

  var shaveOff = false;
  if (shaveOff) {
    var rawGlobe = union(strutObjects);
    //objects.push(rawGlobe);

    // Shave off the parts of the struts that poke out of the corners/
    var innerSphere = CSG.sphere({
      center: [0, 0, 0],
      radius: 1,
      resolution: 32        // optional
    });
    var outerSphere = CSG.sphere({
      center: [0, 0, 0],
      radius: 2,
      resolution: 32        // optional
    });
    var shell = outerSphere.subtract(innerSphere);
    //objects.push(shell);

    var shavedGlobe = rawGlobe.subtract(shell);
    objects.push(shavedGlobe);
  } else {
    objects = objects.concat(strutObjects);
  }


  //objects.push(showSolid(points, newFaces));
  //objects.push(cylinder({start: [0,0,-1], end: [0,0,1], fn:fn, r: 0.02}));
  if (false) {
    var radius = 0.05;
    objects.push(CSG.sphere({center: points[3], radius: radius}).setColor([0,0,1,1]));
    objects.push(CSG.sphere({center: points[0], radius: radius}).setColor([0,0,1,0.7]));
    objects.push(CSG.sphere({center: points[4], radius: radius}).setColor([0,0,1,0.4]));

    objects.push(CSG.sphere({center: points[12], radius: radius}).setColor([1,0,0,1]));
    objects.push(CSG.sphere({center: points[13], radius: radius}).setColor([1,0,0,0.7]));
    objects.push(CSG.sphere({center: points[14], radius: radius}).setColor([1,0,0,0.4]));

    //objects.push(showFaces(points, newFaces.slice(0,3)));
  }

  return objects;
}
