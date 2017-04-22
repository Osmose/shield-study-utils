Cu.import("resource://shield-study-example/lib/MyModule.jsm");

describe('A simple test', () => {
  it('Should work', () => {
    expect(1).toBe(1);
  })
});

describe('MyModule', () => {
  it('should return a value', () => {
    expect(MyModule.numberOne()).toBe(1);
  });
});
