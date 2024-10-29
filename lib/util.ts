export const snakeCaseToCamelCaseKeys = (obj: any): any => {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    const initialKey = String(key);
    newObj[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] =
      obj[initialKey];
  });
  return newObj;
};

export const camelCaseToSnakeCaseKeys = (obj: any): any => {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    const initialKey = String(key);
    newObj[key.replace(/[A-Z]/g, (g) => `_${g.toLowerCase()}`)] =
      obj[initialKey];
  });
  return newObj;
};
