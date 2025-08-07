// ===================================================
// ФАЙЛ: frontend/src/components/Products/ProductImport.jsx
// ✅ ИСПРАВЛЕНО: Правильные импорты и API вызовы
// ===================================================
import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Upload,
  Button,
  Steps,
  Table,
  Select,
  Card,
  Alert,
  Progress,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  message,
  Checkbox,
  Tag,
  Tooltip,
  Switch
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';

// ✅ ИСПРАВЛЕНО: Правильные импорты
import { importProducts, fetchProducts } from '../../store/productsSlice';
import { api } from '../../services'; // Импорт из правильного места

const { Step } = Steps;
const { Option } = Select;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const ProductImport = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.products);

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [mappingConfig, setMappingConfig] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    createCategories: true,
    validatePrices: true,
    skipErrors: false
  });

  React.useEffect(() => {
    if (visible) {
      fetchSuppliers();
      fetchCategories();
    }
  }, [visible]);

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const fetchSuppliers = async () => {
    try {
      const data = await api.suppliers.getSuppliers();
      setSuppliers(data.suppliers || []);
    } catch (error) {
      message.error('Ошибка при загрузке поставщиков');
      console.error('Fetch suppliers error:', error);
    }
  };

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const fetchCategories = async () => {
    try {
      // Предполагаем, что есть метод для получения категорий
      // Если его нет, можем получить уникальные категории из товаров
      const data = await api.products.getProducts({ 
        select: 'category_path',
        distinct: true 
      });
      
      // Извлекаем уникальные категории
      const uniqueCategories = [...new Set(
        data.products
          ?.map(p => p.category_path)
          ?.filter(Boolean) || []
      )];
      
      setCategories(uniqueCategories.map(cat => ({ name: cat, path: cat })));
    } catch (error) {
      message.error('Ошибка при загрузке категорий');
      console.error('Fetch categories error:', error);
    }
  };

  const handleFileUpload = useCallback((file) => {
    setUploadedFile(file);
    
    // Парсинг файла для предварительного просмотра
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Простой парсинг CSV для демонстрации
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1, 11).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim() || '';
            return obj;
          }, {});
        });
        
        setPreviewData(rows);
        setCurrentStep(1);
      } catch (error) {
        message.error('Ошибка при парсинге файла');
        console.error('File parsing error:', error);
      }
    };
    
    reader.readAsText(file);
    return false; // Предотвращаем автоматическую загрузку
  }, []);

  const handleMapping = useCallback(() => {
    if (Object.keys(mappingConfig).length === 0) {
      message.warning('Настройте соответствие полей перед продолжением');
      return;
    }
    setCurrentStep(2);
  }, [mappingConfig]);

  // ✅ ИСПРАВЛЕНО: Используем новую структуру API
  const handleImport = useCallback(async () => {
    if (!uploadedFile) {
      message.error('Файл не выбран');
      return;
    }

    try {
      setCurrentStep(3);
      setImportProgress(0);

      // Создаем объект с настройками импорта
      const importOptionsWithMapping = {
        ...importOptions,
        mapping: mappingConfig,
        supplier_id: selectedSupplier
      };

      // Используем новую структуру API
      const result = await api.products.importProducts(uploadedFile, importOptionsWithMapping);
      
      setImportResults(result);
      setImportProgress(100);
      setCurrentStep(4);
      
      message.success(`Импорт завершен! Обработано: ${result.processed}, Ошибок: ${result.errors || 0}`);
      
      // Обновляем список товаров
      dispatch(fetchProducts());
      
    } catch (error) {
      message.error('Ошибка при импорте товаров');
      console.error('Import error:', error);
      setCurrentStep(2);
    }
  }, [uploadedFile, mappingConfig, importOptions, selectedSupplier, dispatch]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setUploadedFile(null);
    setPreviewData([]);
    setMappingConfig({});
    setImportProgress(0);
    setImportResults(null);
    setSelectedSupplier(null);
  }, []);

  const steps = [
    {
      title: 'Загрузка файла',
      description: 'Выберите файл для импорта',
    },
    {
      title: 'Настройка полей',
      description: 'Настройте соответствие полей',
    },
    {
      title: 'Параметры импорта',
      description: 'Выберите параметры импорта',
    },
    {
      title: 'Импорт',
      description: 'Процесс импорта данных',
    },
    {
      title: 'Результат',
      description: 'Результаты импорта',
    },
  ];

  const requiredFields = [
    { key: 'name', label: 'Название товара', required: true },
    { key: 'sku', label: 'Артикул (SKU)', required: true },
    { key: 'price', label: 'Цена', required: true },
    { key: 'quantity', label: 'Количество', required: false },
    { key: 'category_path', label: 'Категория', required: false },
    { key: 'description', label: 'Описание', required: false },
    { key: 'brand', label: 'Бренд', required: false },
    { key: 'barcode', label: 'Штрихкод', required: false },
  ];

  const renderFileUpload = () => (
    <Card>
      <Title level={4}>Загрузка файла</Title>
      <Dragger
        accept=".xlsx,.xls,.csv"
        beforeUpload={handleFileUpload}
        maxCount={1}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon">
          <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </p>
        <p className="ant-upload-text">Нажмите или перетащите файл в эту область</p>
        <p className="ant-upload-hint">
          Поддерживаются форматы: .xlsx, .xls, .csv
        </p>
      </Dragger>
      
      {uploadedFile && (
        <Alert
          style={{ marginTop: 16 }}
          message={`Файл загружен: ${uploadedFile.name}`}
          type="success"
          showIcon
        />
      )}
    </Card>
  );

  const renderFieldMapping = () => (
    <Card>
      <Title level={4}>Настройка соответствия полей</Title>
      
      {previewData.length > 0 && (
        <>
          <Alert
            style={{ marginBottom: 16 }}
            message="Настройте соответствие между полями в файле и полями системы"
            type="info"
            showIcon
          />
          
          <Row gutter={[16, 16]}>
            {requiredFields.map(field => (
              <Col key={field.key} span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>
                    {field.label}
                    {field.required && <span style={{ color: 'red' }}> *</span>}
                  </Text>
                  <Select
                    placeholder="Выберите поле из файла"
                    style={{ width: '100%' }}
                    value={mappingConfig[field.key]}
                    onChange={(value) => setMappingConfig(prev => ({
                      ...prev,
                      [field.key]: value
                    }))}
                  >
                    {Object.keys(previewData[0] || {}).map(header => (
                      <Option key={header} value={header}>{header}</Option>
                    ))}
                  </Select>
                </Space>
              </Col>
            ))}
          </Row>
          
          <Divider />
          
          <Title level={5}>Предварительный просмотр данных</Title>
          <Table
            dataSource={previewData}
            columns={Object.keys(previewData[0] || {}).map(key => ({
              title: key,
              dataIndex: key,
              key,
              ellipsis: true,
            }))}
            pagination={false}
            scroll={{ x: 800 }}
            size="small"
          />
          
          <Button
            type="primary"
            onClick={handleMapping}
            style={{ marginTop: 16 }}
            disabled={!mappingConfig.name || !mappingConfig.sku || !mappingConfig.price}
          >
            Продолжить
          </Button>
        </>
      )}
    </Card>
  );

  const renderImportOptions = () => (
    <Card>
      <Title level={4}>Параметры импорта</Title>
      
      <Space direction="vertical" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Text strong>Поставщик</Text>
            <Select
              placeholder="Выберите поставщика"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              allowClear
            >
              {suppliers.map(supplier => (
                <Option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
        
        <Divider />
        
        <Title level={5}>Настройки обработки</Title>
        
        <Checkbox
          checked={importOptions.updateExisting}
          onChange={(e) => setImportOptions(prev => ({
            ...prev,
            updateExisting: e.target.checked
          }))}
        >
          Обновлять существующие товары
        </Checkbox>
        
        <Checkbox
          checked={importOptions.createCategories}
          onChange={(e) => setImportOptions(prev => ({
            ...prev,
            createCategories: e.target.checked
          }))}
        >
          Создавать новые категории автоматически
        </Checkbox>
        
        <Checkbox
          checked={importOptions.validatePrices}
          onChange={(e) => setImportOptions(prev => ({
            ...prev,
            validatePrices: e.target.checked
          }))}
        >
          Проверять корректность цен
        </Checkbox>
        
        <Checkbox
          checked={importOptions.skipErrors}
          onChange={(e) => setImportOptions(prev => ({
            ...prev,
            skipErrors: e.target.checked
          }))}
        >
          Пропускать строки с ошибками
        </Checkbox>
        
        <Button
          type="primary"
          onClick={handleImport}
          style={{ marginTop: 16 }}
        >
          Начать импорт
        </Button>
      </Space>
    </Card>
  );

  const renderImportProgress = () => (
    <Card>
      <Title level={4}>Импорт товаров</Title>
      <Progress percent={importProgress} status="active" />
      <Text>Обработка данных...</Text>
    </Card>
  );

  const renderImportResults = () => (
    <Card>
      <Title level={4}>Результаты импорта</Title>
      
      {importResults && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Обработано строк"
                value={importResults.processed || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Успешно добавлено"
                value={importResults.created || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Обновлено"
                value={importResults.updated || 0}
                prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              />
            </Col>
          </Row>
          
          {importResults.errors > 0 && (
            <Alert
              message={`Ошибок: ${importResults.errors}`}
              description="Некоторые строки не удалось обработать"
              type="warning"
              showIcon
            />
          )}
          
          {importResults.errorDetails && importResults.errorDetails.length > 0 && (
            <>
              <Title level={5}>Детали ошибок</Title>
              <Table
                dataSource={importResults.errorDetails}
                columns={[
                  { title: 'Строка', dataIndex: 'row', key: 'row' },
                  { title: 'Ошибка', dataIndex: 'error', key: 'error', ellipsis: true },
                ]}
                pagination={false}
                size="small"
              />
            </>
          )}
          
          <Space>
            <Button onClick={handleReset}>
              Импортировать еще файл
            </Button>
            <Button type="primary" onClick={onClose}>
              Закрыть
            </Button>
          </Space>
        </Space>
      )}
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderFileUpload();
      case 1:
        return renderFieldMapping();
      case 2:
        return renderImportOptions();
      case 3:
        return renderImportProgress();
      case 4:
        return renderImportResults();
      default:
        return renderFileUpload();
    }
  };

  return (
    <Modal
      title="Импорт товаров"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      centered
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map((step, index) => (
          <Step
            key={index}
            title={step.title}
            description={step.description}
            icon={
              index < currentStep ? (
                <CheckCircleOutlined />
              ) : index === currentStep && currentStep === 3 ? (
                <ReloadOutlined spin />
              ) : undefined
            }
          />
        ))}
      </Steps>
      
      {renderStepContent()}
    </Modal>
  );
};

export default ProductImport;