const Beta9 = require("../dist/index");

async function main() {
  Beta9.init({
    apiToken:
      "9Ftik6xP1o1mHPpV9L8Mew7Lpb6lb74O-k0ybHhSjAp7Qd89v7EqNLyMynjYl7NiTM0fn0PBfKQmfafabIUrfg==",
    workspaceId: "103f0baa-6afc-46ca-8749-c053952468d1",
  });

  // const dep = new Beta9.Endpoint({
  //   name: "test",
  // });

  // const w = await dep.realtime("/ws", (e) => {
  //   console.log(e.data);
  // });

  // w.send("Hello");
  // w.send("Hello again");

  // setTimeout(() => {
  //   w.close();
  // }, 1000);

  // try {
  //   await dep.retrieve();
  // } catch (e) {
  //   console.log(e);
  //   return;
  // }
  // console.log(dep.data);

  // const task = new Beta9.Task({ id: "5ffea49c-8410-4681-85af-d9b34c227417" });

  // try {
  //   await task.retrieve();
  // } catch (e) {
  //   console.log(e);
  //   return;
  // }

  const someTask = await Beta9.Task.Retrieve(
    "330ea121-944a-4908-adb8-16ec5e557dc6"
  );
  console.log(someTask.data);
}

main();
