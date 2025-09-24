module.exports = {
  app: {
    http: jest.fn(),
    timer: jest.fn(),
    serviceBusQueue: jest.fn(),
    serviceBusTopic: jest.fn(),
  },
};
