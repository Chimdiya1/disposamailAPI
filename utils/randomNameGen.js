function randomNameGen() {
  let num = Math.floor(Math.random() * 4) + 5;
  let res = "";
  for (let i = 0; i < num; i++) {
    const random = Math.floor(Math.random() * 27);
    res += String.fromCharCode(97 + random);
  }
  return res;
}
module.exports = randomNameGen;
