import axios, { AxiosResponse } from 'axios';
import { apiConfig } from './authentication/auth';

let aitestMode = true;

interface HarborPilotChatResponse {
  actions: HarborPilotAction[];
}
interface HarborPilotAction {
  data: any;
}

export const harborPilotTransformChat = async (
  chat: string,
): Promise<HarborPilotChatResponse> => {
  if (aitestMode) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
    return {
      actions: [
        {
          data: {
            id: '1e65870d-70d0-4b03-adbf-5e2e3196560e',
            name: 'Uppercase First 3 Characters',
            type: 'concat',
            attributes: {
              values: [
                {
                  type: 'upper',
                  attributes: {
                    input: {
                      type: 'substring',
                      attributes: {
                        input: {
                          type: 'tester',
                        },
                        begin: 0,
                        end: 3,
                      },
                    },
                  },
                },
                {
                  type: 'substring',
                  attributes: {
                    input: {
                      type: 'tester',
                    },
                    begin: 3,
                  },
                },
              ],
            },
            internal: false,
          },
        },
      ],
    };
  }

  // Check if apiConfig is available
  if (!apiConfig) {
    throw new Error('Not connected to ISC. Please connect first.');
  }

  let data = JSON.stringify({
    userMsg: chat,
    sessionId: '8f7e6186-72bd-4719-8c6e-95180a770e72',
    context: {
      tools: ['transform-builder'],
    },
  });

  let config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'bearer ' + (await apiConfig.accessToken),
    },
    maxBodyLength: Infinity,
  };

  try {
    const response: AxiosResponse<HarborPilotChatResponse> = await axios.post(
      'http://localhost:7100/beta/harbor-pilot/chat',
      data,
      config,
    );
    return response.data;
  } catch (error) {
    console.error('Error in harbor pilot chat:', error);
    throw error;
  }
};

