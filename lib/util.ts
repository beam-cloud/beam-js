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

export const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};
